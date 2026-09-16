import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Single entry point for turning an ad-brief image prompt into a stored,
 * publicly-hosted image. The provider is swappable — Gemini ("nano banana")
 * is the default for its price and, more importantly, its image-to-image
 * editing: it can take a real product photo and composite it into a scene
 * instead of hallucinating a new product. Add a case below for another
 * provider (OpenAI, Flux, Ideogram) without touching any of the callers.
 */
export type ImageAspectRatio = "square" | "portrait";

export async function generateAdImage(options: {
  prompt: string;
  referenceImageUrl?: string;
  storagePathPrefix: string;
  /**
   * "portrait" is for Instagram Stories (9:16) — a Story posted with a
   * square image gets pillarboxed/cropped oddly by Instagram's Story
   * viewer, which is what actually happens when a "square" creative gets
   * posted there. Defaults to "square" for feed/carousel creatives.
   */
  aspectRatio?: ImageAspectRatio;
}): Promise<string> {
  const geminiKey = await getSetting("IMAGE_GEN_API_KEY");
  const openaiKey = await getSetting("OPENAI_API_KEY");
  const aspectRatio = options.aspectRatio ?? "square";

  let base64Png: string;
  if (geminiKey) {
    try {
      base64Png = await generateWithGemini(geminiKey, options.prompt, options.referenceImageUrl, aspectRatio);
    } catch (err) {
      if (!openaiKey) throw err;
      base64Png = await generateWithOpenAI(openaiKey, options.prompt, aspectRatio);
    }
  } else if (openaiKey) {
    base64Png = await generateWithOpenAI(openaiKey, options.prompt, aspectRatio);
  } else {
    throw new Error(
      "Neither IMAGE_GEN_API_KEY (Gemini) nor OPENAI_API_KEY is set — add one in /admin/settings"
    );
  }

  return uploadGeneratedImage(base64Png, options.storagePathPrefix);
}

async function generateWithOpenAI(apiKey: string, prompt: string, aspectRatio: ImageAspectRatio) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      // gpt-image-1 only offers these three fixed sizes — 1024x1536 is the
      // closest portrait option to a 9:16 Story (there's no exact 9:16 size).
      size: aspectRatio === "portrait" ? "1024x1536" : "1024x1024",
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI image generation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json as string | undefined;
  if (!b64) throw new Error("OpenAI response did not contain an image");
  return b64;
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  referenceImageUrl: string | undefined,
  aspectRatio: ImageAspectRatio
) {
  const orientationInstruction =
    aspectRatio === "portrait"
      ? " The image MUST be composed as a vertical 9:16 portrait frame (like a phone screen, 1080x1920) — full-bleed, with the main subject centered so nothing important sits in the top or bottom strip that a UI overlay might cover."
      : "";
  const parts: Record<string, unknown>[] = [{ text: `${prompt}${orientationInstruction}` }];

  if (referenceImageUrl) {
    const refRes = await fetch(referenceImageUrl);
    if (refRes.ok) {
      const buffer = await refRes.arrayBuffer();
      const mimeType = refRes.headers.get("content-type") ?? "image/png";
      parts.push({
        inlineData: { mimeType, data: Buffer.from(buffer).toString("base64") },
      });
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          imageConfig: { aspectRatio: aspectRatio === "portrait" ? "9:16" : "1:1" },
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini image generation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data
  );
  if (!imagePart) throw new Error("Gemini response did not contain an image");
  return imagePart.inlineData.data as string;
}

async function uploadGeneratedImage(base64Png: string, storagePathPrefix: string) {
  const supabase = getSupabaseServerClient();
  const path = `${storagePathPrefix}/${crypto.randomUUID()}.png`;
  const buffer = Buffer.from(base64Png, "base64");

  const { error } = await supabase.storage
    .from("ad-creatives")
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
  return data.publicUrl;
}
