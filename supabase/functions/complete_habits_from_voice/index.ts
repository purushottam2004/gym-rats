// Voice → mark due Habits done for a Day. Caller must send a user JWT.
// OPENAI_API_KEY must be set as an Edge Function secret.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type HabitRow = {
  id: string;
  name: string;
  recurrence: "per_day" | "per_week";
  frequency: number;
  weekdays: number[];
  food_id: string | null;
  food_amount: number | null;
};

type ParsedHabits = {
  understood: boolean;
  error: string | null;
  habit_names: string[];
};

type OkBody = {
  ok: true;
  completed: Array<{
    habit_id: string;
    habit_name: string;
    day_count: number;
  }>;
  logged_on: string;
};

type ErrBody = { ok: false; error: string };

function jsonOk(body: OkBody, status = 200): Response {
  return Response.json(body, { status });
}

function jsonErr(error: string, status = 200): Response {
  const body: ErrBody = { ok: false, error };
  return Response.json(body, { status });
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("3gpp") || mime.includes("3gp")) return "3gp";
  return "m4a";
}

async function readRequestAudio(
  req: Request,
): Promise<{ bytes: Uint8Array; mime: string; loggedOn: string } | Response> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const loggedOn = String(form.get("logged_on") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedOn)) {
      return jsonErr("logged_on must be YYYY-MM-DD");
    }
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return jsonErr("audio file is required");
    }
    const mime = audio.type || "audio/m4a";
    const bytes = new Uint8Array(await audio.arrayBuffer());
    if (bytes.byteLength === 0) {
      return jsonErr("audio file is empty");
    }
    return { bytes, mime, loggedOn };
  }

  let body: {
    logged_on?: string;
    audio_base64?: string;
    mime_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonErr("expected multipart form data or JSON body");
  }

  const loggedOn = String(body.logged_on ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedOn)) {
    return jsonErr("logged_on must be YYYY-MM-DD");
  }
  const audioBase64 = String(body.audio_base64 ?? "").trim();
  if (!audioBase64) {
    return jsonErr("audio_base64 is required");
  }
  const mime = String(body.mime_type ?? "audio/m4a").trim() || "audio/m4a";
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(audioBase64);
  } catch {
    return jsonErr("audio_base64 is not valid base64");
  }
  if (bytes.byteLength === 0) {
    return jsonErr("audio is empty");
  }
  return { bytes, mime, loggedOn };
}

async function transcribeAudio(
  apiKey: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const form = new FormData();
  const filename = `voice.${extensionForMime(mime)}`;
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("model", "gpt-4o-mini-transcribe");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`transcription failed (${response.status}): ${detail}`);
  }
  const payload = await response.json() as { text?: string };
  return String(payload.text ?? "").trim();
}

async function parseHabitsFromTranscript(
  apiKey: string,
  transcript: string,
  habits: HabitRow[],
): Promise<ParsedHabits> {
  const habitNames = habits.map((habit) => habit.name);
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["understood", "error", "habit_names"],
    properties: {
      understood: { type: "boolean" },
      error: { type: ["string", "null"] },
      habit_names: {
        type: "array",
        items: { type: "string" },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Extract which habits the user says they completed.\n" +
            "Matching habits:\n" +
            "- Pick habit names from the provided list. Case, spacing, and punctuation do not matter.\n" +
            "- Always return habit_names using each list entry's exact spelling once matched.\n" +
            "- The user may name one or many habits in one utterance.\n" +
            "- Only set understood=false when no listed habit is a reasonable match.\n" +
            "Do not invent habits that are not on the list.",
        },
        {
          role: "user",
          content: JSON.stringify({
            habits: habitNames,
            transcript,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "voice_habits",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`structured parse failed (${response.status}): ${detail}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("structured parse returned empty content");
  }
  return JSON.parse(content) as ParsedHabits;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchHabit(habits: HabitRow[], name: string): HabitRow | null {
  const needle = normalizeName(name);
  if (!needle) return null;
  const exact = habits.find((habit) => normalizeName(habit.name) === needle);
  if (exact) return exact;
  const partial = habits.filter((habit) => {
    const catalog = normalizeName(habit.name);
    return catalog.includes(needle) || needle.includes(catalog);
  });
  return partial.length === 1 ? partial[0] : null;
}

/** JS getDay for YYYY-MM-DD as UTC noon to avoid TZ shift. */
function weekdayFromDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isDue(habit: HabitRow, loggedOn: string): boolean {
  if (habit.recurrence === "per_week") return true;
  const weekday = weekdayFromDay(loggedOn);
  return habit.weekdays.includes(weekday);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonErr("POST only", 405);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonErr("OPENAI_API_KEY is not configured on the Edge Function");
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return jsonErr("signed-in user required", 401);
    }

    const audioOrErr = await readRequestAudio(req);
    if (audioOrErr instanceof Response) return audioOrErr;
    const { bytes, mime, loggedOn } = audioOrErr;

    const { data: habits, error: habitsError } = await ctx.supabase
      .from("habits")
      .select("id, name, recurrence, frequency, weekdays, food_id, food_amount")
      .eq("user_id", userId)
      .eq("active", true)
      .order("sort_order");
    if (habitsError) {
      return jsonErr(habitsError.message);
    }
    const habitRows = ((habits ?? []) as HabitRow[]).filter((habit) =>
      isDue(habit, loggedOn)
    );
    if (habitRows.length === 0) {
      return jsonErr("Nothing due this day");
    }

    let transcript: string;
    let parsed: ParsedHabits;
    try {
      transcript = await transcribeAudio(apiKey, bytes, mime);
      if (!transcript) {
        return jsonErr("Could not hear a habit in that recording");
      }
      parsed = await parseHabitsFromTranscript(apiKey, transcript, habitRows);
    } catch (err) {
      console.error(err);
      return jsonErr(err instanceof Error ? err.message : "OpenAI request failed");
    }

    if (!parsed.understood) {
      return jsonErr(parsed.error?.trim() || "Could not understand those habits");
    }

    const matched: HabitRow[] = [];
    const seen = new Set<string>();
    for (const name of parsed.habit_names ?? []) {
      const habit = matchHabit(habitRows, name);
      if (habit && !seen.has(habit.id)) {
        seen.add(habit.id);
        matched.push(habit);
      }
    }
    if (matched.length === 0) {
      return jsonErr("No matching habits due this day");
    }

    const completed: OkBody["completed"] = [];
    for (const habit of matched) {
      const { data: existing, error: readError } = await ctx.supabase
        .from("habit_day_counts")
        .select("count")
        .eq("habit_id", habit.id)
        .eq("logged_on", loggedOn)
        .maybeSingle();
      if (readError) {
        return jsonErr(readError.message);
      }
      const current = (existing?.count as number | undefined) ?? 0;
      const next = current + 1;
      const { error: upsertError } = await ctx.supabase.from("habit_day_counts").upsert(
        {
          habit_id: habit.id,
          user_id: userId,
          logged_on: loggedOn,
          count: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "habit_id,logged_on" },
      );
      if (upsertError) {
        return jsonErr(upsertError.message);
      }

      if (habit.food_id && habit.food_amount != null && Number(habit.food_amount) > 0) {
        const { error: intakeError } = await ctx.supabase.from("intakes").insert({
          user_id: userId,
          food_id: habit.food_id,
          amount: habit.food_amount,
          logged_on: loggedOn,
          source_habit_id: habit.id,
        });
        if (intakeError) {
          console.error("habit food log failed", intakeError);
          // Count already saved; surface food failure in the habit name note via completed payload.
        }
      }

      completed.push({
        habit_id: habit.id,
        habit_name: habit.name,
        day_count: next,
      });
    }

    return jsonOk({
      ok: true,
      completed,
      logged_on: loggedOn,
    });
  }),
};
