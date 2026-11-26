// Photo → suggested Other-entry nutrients. Caller must send a user JWT.
// Does NOT write intakes/foods — the app opens the Other screen for review.
// OPENAI_API_KEY must be set as an Edge Function secret.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type NutrientRow = { id: string; name: string; unit: string };

type ParsedEstimate = {
  understood: boolean;
  error: string | null;
  name: string | null;
  nutrients: { nutrient_id: string; amount: number }[];
};

type OkBody = {
  ok: true;
  food: {
    name: string;
    nutrients: { nutrient_id: string; name: string; unit: string; amount: number }[];
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

function normalizeImageMime(raw: string): string {
  const mime = raw.trim().toLowerCase() || "image/jpeg";
  if (mime === "image/jpg") return "image/jpeg";
  if (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/gif"
  ) {
    return mime;
  }
  return "image/jpeg";
}

async function readRequestImage(
  req: Request,
): Promise<{ bytes: Uint8Array; mime: string; base64: string } | Response> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return jsonErr("image file is required");
    }
    const mime = normalizeImageMime(image.type || "image/jpeg");
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (bytes.byteLength === 0) {
      return jsonErr("image file is empty");
    }
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return { bytes, mime, base64: btoa(binary) };
  }

  let body: {
    image_base64?: string;
    mime_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonErr("expected multipart form data or JSON body");
  }

  const imageBase64 = String(body.image_base64 ?? "").trim();
  if (!imageBase64) {
    return jsonErr("image_base64 is required");
  }
  const mime = normalizeImageMime(String(body.mime_type ?? "image/jpeg"));
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(imageBase64);
  } catch {
    return jsonErr("image_base64 is not valid base64");
  }
  if (bytes.byteLength === 0) {
    return jsonErr("image is empty");
  }
  // ~4.5MB decoded — keep Edge + OpenAI payloads reasonable.
  if (bytes.byteLength > 4_500_000) {
    return jsonErr("image is too large; try a closer photo");
  }
  return { bytes, mime, base64: imageBase64 };
}

async function estimateFromPhoto(
  apiKey: string,
  mime: string,
  base64: string,
  nutrients: NutrientRow[],
): Promise<ParsedEstimate> {
  const catalog = nutrients.map((row) => ({
    nutrient_id: row.id,
    name: row.name,
    unit: row.unit,
  }));

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["understood", "error", "name", "nutrients"],
    properties: {
      understood: { type: "boolean" },
      error: { type: ["string", "null"] },
      name: { type: ["string", "null"] },
      nutrients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nutrient_id", "amount"],
          properties: {
            nutrient_id: { type: "string" },
            amount: { type: "number" },
          },
        },
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
      // Strong vision model for plate → nutrient estimates.
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You estimate nutrients for food visible in a photo so the user can log a one-off Other entry.\n" +
            "Rules:\n" +
            "- name: short food label for the whole plate/portion (e.g. \"Chicken rice bowl\").\n" +
            "- nutrients: totals for everything visible in the photo (not per 100g). Use only nutrient_id values from the provided catalog.\n" +
            "- amount must be >= 0 in that nutrient's unit. Omit a nutrient or use 0 when unknown.\n" +
            "- Prefer realistic adult serving estimates. Water may be 0 unless a drink is clearly present.\n" +
            "- Creatine is usually 0 unless a labeled supplement is visible.\n" +
            "- If the image is not food or is unusable, set understood=false and explain in error.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({ nutrients: catalog }),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "food_photo_estimate",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`vision estimate failed (${response.status}): ${detail}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("vision estimate returned empty content");
  }
  return JSON.parse(content) as ParsedEstimate;
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

    const imageOrErr = await readRequestImage(req);
    if (imageOrErr instanceof Response) return imageOrErr;
    const { mime, base64 } = imageOrErr;

    const { data: nutrientRows, error: nutrientsError } = await ctx.supabase
      .from("nutrients")
      .select("id, name, unit")
      .order("name");
    if (nutrientsError) {
      return jsonErr(nutrientsError.message);
    }
    const nutrients = (nutrientRows ?? []) as NutrientRow[];
    if (nutrients.length === 0) {
      return jsonErr("No nutrients configured");
    }

    let parsed: ParsedEstimate;
    try {
      parsed = await estimateFromPhoto(apiKey, mime, base64, nutrients);
    } catch (err) {
      console.error(err);
      return jsonErr(err instanceof Error ? err.message : "OpenAI request failed");
    }

    if (!parsed.understood) {
      return jsonErr(parsed.error?.trim() || "Could not estimate food from that photo");
    }

    const byId = new Map(nutrients.map((row) => [row.id, row]));
    const suggested: OkBody["food"]["nutrients"] = [];
    for (const row of parsed.nutrients ?? []) {
      const meta = byId.get(row.nutrient_id);
      if (!meta) continue;
      if (typeof row.amount !== "number" || Number.isNaN(row.amount) || !(row.amount > 0)) {
        continue;
      }
      suggested.push({
        nutrient_id: meta.id,
        name: meta.name,
        unit: meta.unit,
        amount: row.amount,
      });
    }

    if (suggested.length === 0) {
      return jsonErr("No nutrient amounts could be estimated from that photo");
    }

    const name = String(parsed.name ?? "").trim() || "Other";
    return jsonOk({
      ok: true,
      food: { name, nutrients: suggested },
    });
  }),
};

/* To invoke locally (user JWT required):

  curl -i --request POST 'http://127.0.0.1:54321/functions/v1/estimate_food_from_photo' \
    --header "Authorization: Bearer <USER_ACCESS_TOKEN>" \
    --header "apikey: <SUPABASE_PUBLISHABLE_KEY>" \
    --header 'Content-Type: application/json' \
    --data '{"image_base64":"<base64>","mime_type":"image/jpeg"}'

*/
