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
export type ImageAspectRatio = "square" | "portrait" | "portrait4x5";

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
      const refs = options.referenceImageUrl ? [options.referenceImageUrl] : undefined;
      base64Png = await generateWithGemini(geminiKey, options.prompt, refs, aspectRatio);
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
  referenceImageUrls: string[] | undefined,
  aspectRatio: ImageAspectRatio
) {
  const orientationInstruction =
    aspectRatio === "portrait"
      ? " The image MUST be composed as a vertical 9:16 portrait frame (like a phone screen, 1080x1920) — full-bleed, with the main subject centered so nothing important sits in the top or bottom strip that a UI overlay might cover."
      : aspectRatio === "portrait4x5"
        ? " The image MUST be composed as a 4:5 portrait frame, full-bleed."
        : "";
  const parts: Record<string, unknown>[] = [{ text: `${prompt}${orientationInstruction}` }];

  for (const url of referenceImageUrls ?? []) {
    const refRes = await fetch(url);
    if (refRes.ok) {
      const buffer = await refRes.arrayBuffer();
      const mimeType = refRes.headers.get("content-type") ?? "image/png";
      parts.push({
        inlineData: { mimeType, data: Buffer.from(buffer).toString("base64") },
      });
    }
  }

  const geminiAspectRatio =
    aspectRatio === "portrait" ? "9:16" : aspectRatio === "portrait4x5" ? "4:5" : "1:1";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          imageConfig: { aspectRatio: geminiAspectRatio },
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

/**
 * Turns 1-3 uploaded product-angle photos into a model/lifestyle shot via
 * Gemini image-to-image, using the same prompt style established for the
 * launch catalogue's model photography (realistic young Indian model,
 * editorial studio look, portrait 4:5). Used from /admin/add-chapter (new
 * product) and /admin/product-images (existing product) — both just need
 * the reference angle URLs and a gender.
 *
 * Every generated photo is also logged into marketing_assets tagged
 * "generated-model" so it shows up in /admin/models for reuse in social
 * posts, independent of whether it ends up attached to a product.
 */
export async function generateModelPhoto(options: {
  referenceImageUrls: string[];
  gender: "male" | "female";
  /** For the marketing_assets label/tags — purely organizational, not required. */
  productName?: string;
  chapterSlug?: string;
}): Promise<string> {
  const geminiKey = await getSetting("IMAGE_GEN_API_KEY");
  if (!geminiKey) {
    throw new Error("IMAGE_GEN_API_KEY (Gemini) is not set — add it in /admin/settings first");
  }

  const prompt = `Here ${
    options.referenceImageUrls.length > 1 ? "are transparent PNG cutouts" : "is a transparent PNG cutout"
  } of a pair of sunglasses${options.productName ? `: "${options.productName}"` : ""}.

Generate a realistic, professional studio/lifestyle photo of a young Indian ${options.gender} model (age 22–30) wearing this exact pair of sunglasses. Match the frame shape, color, and lens tint in the reference image(s) exactly — do not change the design in any way.

Style: clean, editorial, fashion-forward, confident. Soft natural light or a simple neutral studio background (light grey or off-white), shot from the chest up, front-facing or a slight 3/4 turn, genuine smile or relaxed expression. No text, no logos, no watermarks.`;

  const base64Png = await generateWithGemini(geminiKey, prompt, options.referenceImageUrls, "portrait4x5");
  const url = await uploadGeneratedImage(base64Png, "model-photos");

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("marketing_assets").insert({
      url,
      label: options.productName ? `${options.productName} — ${options.gender} model` : `Generated ${options.gender} model`,
      tags: ["generated-model", options.gender, ...(options.chapterSlug ? [options.chapterSlug] : [])],
    });
  } catch (err) {
    // Never let the asset-log fail the actual generation the admin is waiting on.
    console.error("Failed to log generated model photo to marketing_assets", err);
  }

  return url;
}
