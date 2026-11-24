// Voice → structured set log. Caller must send a user JWT (supabase.functions.invoke).
// OPENAI_API_KEY must be set as an Edge Function secret (local: edge_runtime.secrets / supabase secrets set --local).

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type LiftRow = { id: string; name: string };

type ParsedSet = {
  understood: boolean;
  error: string | null;
  lift_name: string | null;
  attempt: number | null;
  reps: number | null;
  load_kg: number | null;
};

type OkBody = {
  ok: true;
  set: {
    id: string;
    lift_name: string;
    attempt: number;
    reps: number;
    load_kg: number;
    logged_on: string;
  };
};

type ErrBody = { ok: false; error: string };

function jsonOk(body: OkBody, status = 200): Response {
  return Response.json(body, { status });
}

/** Prefer HTTP 200 for user-facing failures so the app toast can read `error` from `data`. */
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

async function parseSetFromTranscript(
  apiKey: string,
  transcript: string,
  lifts: LiftRow[],
): Promise<ParsedSet> {
  const liftNames = lifts.map((lift) => lift.name);
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["understood", "error", "lift_name", "attempt", "reps", "load_kg"],
    properties: {
      understood: { type: "boolean" },
      error: { type: ["string", "null"] },
      lift_name: { type: ["string", "null"] },
      attempt: { type: ["integer", "null"] },
      reps: { type: ["integer", "null"] },
      load_kg: { type: ["number", "null"] },
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
            "Extract one gym set from the user's spoken log.\n" +
            "Matching lifts:\n" +
            "- Pick the lift whose name matches what they said. Case, spacing, and punctuation do not matter " +
            '("bench" matches "Bench"; "overhead press" matches "Overhead Press").\n' +
            "- Always return lift_name using the list entry's exact spelling once matched.\n" +
            "- Only set understood=false for lift_name when no list lift is a reasonable match.\n" +
            "Numbers:\n" +
            "- attempt and reps are whole numbers >= 1. load_kg is kilograms >= 0.\n" +
            "- Convert spoken weight units when needed (e.g. 100 pounds ≈ 45.4 kg). Do not reject unusual loads.\n" +
            "If speech is unclear or a required field cannot be determined, set understood=false and explain in error.",
        },
        {
          role: "user",
          content: JSON.stringify({
            lifts: liftNames,
            transcript,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "voice_set",
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
  return JSON.parse(content) as ParsedSet;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchLift(lifts: LiftRow[], name: string | null): LiftRow | null {
  if (!name) return null;
  const needle = normalizeName(name);
  if (!needle) return null;
  const exact = lifts.find((lift) => normalizeName(lift.name) === needle);
  if (exact) return exact;
  const partial = lifts.filter((lift) => {
    const catalog = normalizeName(lift.name);
    return catalog.includes(needle) || needle.includes(catalog);
  });
  return partial.length === 1 ? partial[0] : null;
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

    const { data: lifts, error: liftsError } = await ctx.supabase
      .from("lifts")
      .select("id, name")
      .order("name");
    if (liftsError) {
      return jsonErr(liftsError.message);
    }
    const liftRows = (lifts ?? []) as LiftRow[];
    if (liftRows.length === 0) {
      return jsonErr("Add a lift to the catalog first");
    }

    let transcript: string;
    let parsed: ParsedSet;
    try {
      transcript = await transcribeAudio(apiKey, bytes, mime);
      if (!transcript) {
        return jsonErr("Could not hear a set in that recording");
      }
      parsed = await parseSetFromTranscript(apiKey, transcript, liftRows);
    } catch (err) {
      console.error(err);
      return jsonErr(err instanceof Error ? err.message : "OpenAI request failed");
    }

    if (!parsed.understood) {
      return jsonErr(parsed.error?.trim() || "Could not understand that set");
    }

    const lift = matchLift(liftRows, parsed.lift_name);
    if (!lift) {
      return jsonErr(
        parsed.lift_name
          ? `No lift named "${parsed.lift_name}"`
          : "Lift name missing",
      );
    }

    const attempt = parsed.attempt;
    const reps = parsed.reps;
    const loadKg = parsed.load_kg;
    if (!Number.isInteger(attempt) || (attempt as number) < 1) {
      return jsonErr("Attempt must be a whole number, 1 or more");
    }
    if (!Number.isInteger(reps) || (reps as number) < 1) {
      return jsonErr("Reps must be a whole number, 1 or more");
    }
    if (typeof loadKg !== "number" || Number.isNaN(loadKg) || loadKg < 0) {
      return jsonErr("Kilograms cannot be negative");
    }

    const { data: inserted, error: insertError } = await ctx.supabase
      .from("sets")
      .insert({
        user_id: userId,
        lift_id: lift.id,
        logged_on: loggedOn,
        attempt,
        reps,
        load_kg: loadKg,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return jsonErr(insertError?.message ?? "Could not save set");
    }

    return jsonOk({
      ok: true,
      set: {
        id: inserted.id as string,
        lift_name: lift.name,
        attempt: attempt as number,
        reps: reps as number,
        load_kg: loadKg as number,
        logged_on: loggedOn,
      },
    });
  }),
};

/* To invoke locally (user JWT required):

  curl -i --request POST 'http://127.0.0.1:54321/functions/v1/add_set_from_voice' \
    --header "Authorization: Bearer <USER_ACCESS_TOKEN>" \
    --header "apikey: <SUPABASE_PUBLISHABLE_KEY>" \
    --header 'Content-Type: application/json' \
    --data '{"logged_on":"2026-11-23","audio_base64":"<base64>","mime_type":"audio/m4a"}'

*/
