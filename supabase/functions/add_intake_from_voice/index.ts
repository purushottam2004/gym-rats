// Voice → structured food intake. Caller must send a user JWT (supabase.functions.invoke).
// OPENAI_API_KEY must be set as an Edge Function secret (local: edge_runtime.secrets / supabase secrets set --local).

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type FoodRow = { id: string; name: string; measure: string };

type ParsedIntake = {
  understood: boolean;
  error: string | null;
  food_name: string | null;
  amount: number | null;
};

type OkBody = {
  ok: true;
  intake: {
    id: string;
    food_name: string;
    amount: number;
    measure: string;
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

async function parseIntakeFromTranscript(
  apiKey: string,
  transcript: string,
  foods: FoodRow[],
): Promise<ParsedIntake> {
  const foodCatalog = foods.map((food) => ({
    name: food.name,
    measure: food.measure,
  }));
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["understood", "error", "food_name", "amount"],
    properties: {
      understood: { type: "boolean" },
      error: { type: ["string", "null"] },
      food_name: { type: ["string", "null"] },
      amount: { type: ["number", "null"] },
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
            "Extract one food intake from the user's spoken diet log.\n" +
            "Matching foods:\n" +
            "- Pick the catalog food whose name matches what they said. Case, spacing, and punctuation do not matter " +
            '("water" matches "Water"; "oat milk" matches "Oat Milk").\n' +
            "- Always return food_name using the catalog entry's exact spelling once matched.\n" +
            "- Only set understood=false for food_name when no catalog food is a reasonable match.\n" +
            "Amounts and units:\n" +
            "- amount must be a number > 0 in that food's catalog measure (g, ml, or unit).\n" +
            "- Convert spoken units into that measure. Examples: 1 litre/liter of an ml food → 1000; " +
            "500 ml → 500; 1 kg of a g food → 1000; 250 g → 250; half a litre → 500. " +
            "For measure \"unit\", amount is how many units (e.g. two bananas → 2).\n" +
            "- Do NOT judge whether the amount is a realistic serving size. Large amounts like 1000 ml are valid.\n" +
            "- Never reject an intake only because the quantity sounds large or small.\n" +
            "If speech is unclear or amount cannot be determined, set understood=false and explain in error.",
        },
        {
          role: "user",
          content: JSON.stringify({
            foods: foodCatalog,
            transcript,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "voice_intake",
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
  return JSON.parse(content) as ParsedIntake;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchFood(foods: FoodRow[], name: string | null): FoodRow | null {
  if (!name) return null;
  const needle = normalizeName(name);
  if (!needle) return null;
  const exact = foods.find((food) => normalizeName(food.name) === needle);
  if (exact) return exact;
  // Prefer a unique catalog name that contains the spoken name (or vice versa).
  const partial = foods.filter((food) => {
    const catalog = normalizeName(food.name);
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

    const { data: foods, error: foodsError } = await ctx.supabase
      .from("foods")
      .select("id, name, measure")
      .eq("user_id", userId)
      .order("name");
    if (foodsError) {
      return jsonErr(foodsError.message);
    }
    const foodRows = (foods ?? []) as FoodRow[];
    if (foodRows.length === 0) {
      return jsonErr("Add a food to your catalog first");
    }

    let transcript: string;
    let parsed: ParsedIntake;
    try {
      transcript = await transcribeAudio(apiKey, bytes, mime);
      if (!transcript) {
        return jsonErr("Could not hear a food in that recording");
      }
      parsed = await parseIntakeFromTranscript(apiKey, transcript, foodRows);
    } catch (err) {
      console.error(err);
      return jsonErr(err instanceof Error ? err.message : "OpenAI request failed");
    }

    if (!parsed.understood) {
      return jsonErr(parsed.error?.trim() || "Could not understand that food");
    }

    const food = matchFood(foodRows, parsed.food_name);
    if (!food) {
      return jsonErr(
        parsed.food_name
          ? `No food named "${parsed.food_name}"`
          : "Food name missing",
      );
    }

    const amount = parsed.amount;
    if (typeof amount !== "number" || Number.isNaN(amount) || !(amount > 0)) {
      return jsonErr("Amount must be greater than zero");
    }

    const { data: inserted, error: insertError } = await ctx.supabase
      .from("intakes")
      .insert({
        user_id: userId,
        food_id: food.id,
        amount,
        logged_on: loggedOn,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return jsonErr(insertError?.message ?? "Could not save food");
    }

    return jsonOk({
      ok: true,
      intake: {
        id: inserted.id as string,
        food_name: food.name,
        amount,
        measure: food.measure,
        logged_on: loggedOn,
      },
    });
  }),
};

/* To invoke locally (user JWT required):

  curl -i --request POST 'http://127.0.0.1:54321/functions/v1/add_intake_from_voice' \
    --header "Authorization: Bearer <USER_ACCESS_TOKEN>" \
    --header "apikey: <SUPABASE_PUBLISHABLE_KEY>" \
    --header 'Content-Type: application/json' \
    --data '{"logged_on":"2026-11-23","audio_base64":"<base64>","mime_type":"audio/m4a"}'

*/
