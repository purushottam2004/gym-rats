// Multi-photo → suggested book title, author, and TOC chapters.
// Does NOT write books/chapters — the app opens New book for review.
// OPENAI_API_KEY must be set as an Edge Function secret.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type ChapterDraft = {
  title: string;
  page_start: number | null;
  page_end: number | null;
};

type ParsedEstimate = {
  understood: boolean;
  error: string | null;
  title: string | null;
  author: string | null;
  chapters: ChapterDraft[];
};

type OkBody = {
  ok: true;
  book: {
    title: string;
    author: string | null;
    chapters: ChapterDraft[];
  };
};

type ErrBody = { ok: false; error: string };

type ImagePart = { mime: string; base64: string };

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

async function readRequestImages(req: Request): Promise<ImagePart[] | Response> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const images: ImagePart[] = [];
    for (const value of form.getAll("images")) {
      if (!(value instanceof File)) continue;
      const mime = normalizeImageMime(value.type || "image/jpeg");
      const bytes = new Uint8Array(await value.arrayBuffer());
      if (bytes.byteLength === 0) continue;
      if (bytes.byteLength > 4_500_000) {
        return jsonErr("one image is too large; try a closer photo");
      }
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      images.push({ mime, base64: btoa(binary) });
    }
    if (images.length === 0) {
      return jsonErr("at least one image is required");
    }
    if (images.length > 8) {
      return jsonErr("too many photos; send up to 8");
    }
    return images;
  }

  let body: {
    images?: { image_base64?: string; mime_type?: string }[];
    image_base64?: string;
    mime_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonErr("expected multipart form data or JSON body");
  }

  const rawImages = Array.isArray(body.images)
    ? body.images
    : body.image_base64
    ? [{ image_base64: body.image_base64, mime_type: body.mime_type }]
    : [];

  const images: ImagePart[] = [];
  for (const row of rawImages) {
    const imageBase64 = String(row.image_base64 ?? "").trim();
    if (!imageBase64) continue;
    const mime = normalizeImageMime(String(row.mime_type ?? "image/jpeg"));
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(imageBase64);
    } catch {
      return jsonErr("image_base64 is not valid base64");
    }
    if (bytes.byteLength === 0) continue;
    if (bytes.byteLength > 4_500_000) {
      return jsonErr("one image is too large; try a closer photo");
    }
    images.push({ mime, base64: imageBase64 });
  }

  if (images.length === 0) {
    return jsonErr("at least one image is required");
  }
  if (images.length > 8) {
    return jsonErr("too many photos; send up to 8");
  }
  return images;
}

async function estimateFromPhotos(
  apiKey: string,
  images: ImagePart[],
): Promise<ParsedEstimate> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["understood", "error", "title", "author", "chapters"],
    properties: {
      understood: { type: "boolean" },
      error: { type: ["string", "null"] },
      title: { type: ["string", "null"] },
      author: { type: ["string", "null"] },
      chapters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "page_start", "page_end"],
          properties: {
            title: { type: "string" },
            page_start: { type: ["number", "null"] },
            page_end: { type: ["number", "null"] },
          },
        },
      },
    },
  };

  const imageContent = images.map((image) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${image.mime};base64,${image.base64}`,
      detail: "high" as const,
    },
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You extract book metadata from one or more photos of a book cover, spine, title page, and/or table of contents.\n" +
            "Rules:\n" +
            "- title: the book title.\n" +
            "- author: primary author name(s), or null if unknown.\n" +
            "- chapters: ordered TOC entries with titles; include page_start/page_end when visible, else null.\n" +
            "- Prefer chapter/part headings over every tiny subsection when the TOC is huge (cap ~80 entries).\n" +
            "- If the images are not a book or are unusable, set understood=false and explain in error.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract title, author, and table of contents from these ${images.length} photo(s).`,
            },
            ...imageContent,
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "book_photo_estimate",
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

function normalizePage(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || value < 1) return null;
  return Math.round(value);
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

    const imagesOrErr = await readRequestImages(req);
    if (imagesOrErr instanceof Response) return imagesOrErr;

    let parsed: ParsedEstimate;
    try {
      parsed = await estimateFromPhotos(apiKey, imagesOrErr);
    } catch (err) {
      console.error(err);
      return jsonErr(err instanceof Error ? err.message : "OpenAI request failed");
    }

    if (!parsed.understood) {
      return jsonErr(parsed.error?.trim() || "Could not read a book from those photos");
    }

    const title = String(parsed.title ?? "").trim();
    if (!title) {
      return jsonErr("Could not read a book title from those photos");
    }

    const authorRaw = String(parsed.author ?? "").trim();
    const chapters: ChapterDraft[] = [];
    for (const row of parsed.chapters ?? []) {
      const chapterTitle = String(row.title ?? "").trim();
      if (!chapterTitle) continue;
      let pageStart = normalizePage(row.page_start);
      let pageEnd = normalizePage(row.page_end);
      if (pageStart != null && pageEnd != null && pageEnd < pageStart) {
        pageEnd = pageStart;
      }
      chapters.push({
        title: chapterTitle,
        page_start: pageStart,
        page_end: pageEnd,
      });
    }

    return jsonOk({
      ok: true,
      book: {
        title,
        author: authorRaw || null,
        chapters,
      },
    });
  }),
};

/* To invoke locally (user JWT required):

  curl -i --request POST 'http://127.0.0.1:54321/functions/v1/estimate_book_from_photos' \
    --header "Authorization: Bearer <USER_ACCESS_TOKEN>" \
    --header "apikey: <SUPABASE_PUBLISHABLE_KEY>" \
    --header 'Content-Type: application/json' \
    --data '{"images":[{"image_base64":"<base64>","mime_type":"image/jpeg"}]}'

*/
