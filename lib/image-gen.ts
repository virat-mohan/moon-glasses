import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/brand";

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
      // OpenAI's images API is text-to-image only — it can't respect a
      // reference photo. Falling back to it for a product-specific request
      // (referenceImageUrl set) would silently hallucinate the product's
      // design instead of rendering the real uploaded one, so that case
      // must fail loudly rather than fall back.
      if (!openaiKey || options.referenceImageUrl) throw err;
      base64Png = await generateWithOpenAI(openaiKey, options.prompt, aspectRatio);
    }
  } else if (openaiKey) {
    if (options.referenceImageUrl) {
      throw new Error(
        "Only Gemini (IMAGE_GEN_API_KEY) can generate from a real product reference photo — OpenAI's image API is text-to-image only. Add a Gemini key in /admin/settings to generate product-specific images."
      );
    }
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

  // Static chapters' reference images resolve to site-relative paths
  // (e.g. "/images/chapters/.../front_no_bg.png") — fine for next/image in
  // the browser, but Node's server-side fetch() throws "Failed to parse
  // URL" on anything that isn't absolute. Supplier-sourced products already
  // store full Supabase URLs, so this only ever kicks in for the former.
  let siteUrl: string | null = null;
  for (const url of referenceImageUrls ?? []) {
    let absoluteUrl = url;
    if (!/^https?:\/\//.test(url)) {
      siteUrl ??= (await getBrandProfile()).siteUrl.replace(/\/$/, "");
      absoluteUrl = `${siteUrl}${url}`;
    }
    const refRes = await fetch(absoluteUrl);
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
  if (!imagePart) {
    // A 200 OK with no image usually means Gemini declined and explained
    // why instead — in a text part, a block reason, or a finish reason —
    // rather than an outright API failure. Surfacing that instead of a
    // generic message is the difference between "try again" and actually
    // knowing the edit instruction needs to change.
    const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
    const blockReason = data.promptFeedback?.blockReason;
    const finishReason = data.candidates?.[0]?.finishReason;
    const detail = textPart || blockReason || finishReason;
    throw new Error(
      detail
        ? `Gemini didn't return an image: ${detail}`
        : `Gemini response did not contain an image (raw response: ${JSON.stringify(data).slice(0, 500)})`
    );
  }
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
 * Gemini image-to-image (night-out, editorial mood — see the prompt below).
 * Used from /admin/master-inventory, /admin/add-chapter (new product), and
 * /admin/product-images (existing product) — all just need the reference
 * angle URLs and a gender.
 *
 * Generated at 4:5 portrait (rendered ~1080x1350) — the aspect ratio the
 * homepage tile flip (CollectionItem) and the product page gallery both
 * expect, and one that also crops cleanly to a mobile full-bleed hero or a
 * square Instagram feed post without the face/product being cut off. If a
 * true full-bleed 9:16 mobile Story/Reel asset is ever needed instead, pass
 * "portrait" (9:16, ~1080x1920) to generateWithGemini the way generateAdImage
 * does — not needed for product/model photos today.
 *
 * Every generated photo is also logged into marketing_assets tagged
 * "generated-model" so it shows up in /admin/models for reuse in social
 * posts, independent of whether it ends up attached to a product.
 */
// Picked randomly per call, 50/50, so a batch of generations doesn't all
// stare the same direction — "some looking left, some looking right"
// across repeated Generate/Regenerate clicks on different (or the same)
// product.
const GAZE_VARIANTS = [
  "head turned slightly to their left, gazing off past the camera, mid-laugh, hair/light catching the turn",
  "head turned slightly to their right, gazing off past the camera, mid-laugh, hair/light catching the turn",
];

// Randomized per call, same reasoning as GAZE_VARIANTS — without this,
// generating model photos for several products back to back tends to
// produce the same model and the same outfit each time, since the rest of
// the prompt barely changes call to call. This is what actually makes
// "wardrobe" a variable instead of an incidental constant.
const WARDROBE_VARIANTS = [
  "a sharp open-collar shirt, sleeves loosely rolled",
  "a fitted blazer worn open over a simple top",
  "a satin or silk slip top",
  "a leather jacket over a fitted top",
  "a turtleneck paired with statement gold jewelry",
  "an off-shoulder or halter top",
  "a relaxed oversized shirt tucked in at the front",
  "a fitted knit top with a delicate chain necklace",
];

// Same reasoning as GAZE_VARIANTS/WARDROBE_VARIANTS — left as one fixed
// phrase, Gemini kept defaulting to string lights behind almost every
// model, making a batch of generations feel repetitive. Randomizing the
// backdrop keeps every shot a "party" without it being the same party.
const BACKDROP_VARIANTS = [
  "warm string lights softly blurred behind them",
  "the moody glow of a club's colored stage lighting",
  "the suggestion of a crowd dancing and moving in the background",
  "a rooftop night party with city lights blurred in the distance",
  "a bar backdrop with warm bottle-lit shelving softly out of focus",
  "confetti or light haze drifting through the air behind them",
];

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

  const gaze = GAZE_VARIANTS[Math.floor(Math.random() * GAZE_VARIANTS.length)];
  const wardrobe = WARDROBE_VARIANTS[Math.floor(Math.random() * WARDROBE_VARIANTS.length)];
  const backdrop = BACKDROP_VARIANTS[Math.floor(Math.random() * BACKDROP_VARIANTS.length)];

  const prompt = `Here ${
    options.referenceImageUrls.length > 1 ? "are transparent PNG cutouts" : "is a transparent PNG cutout"
  } of a pair of sunglasses${options.productName ? `: "${options.productName}"` : ""}.

Generate a realistic, professional lifestyle photo of a good-looking, well-groomed, sexy Indian ${options.gender} model (age 22–35) wearing this exact pair of sunglasses. Match the frame shape, color, and lens tint in the reference image(s) exactly — do not change the design in any way. Give this model their own distinct look — a different face, hairstyle, and styling than you would default to — rather than repeating the same model identity across separate generations.

Mood: at a lively party — genuinely joyful, mid-laugh or grinning, full of energy, having a great time. No drink, glass, or bottle in hand or anywhere in frame. ${gaze}.

Wardrobe: ${wardrobe}, in black, white, or another neutral tone — not matched to the lens tint. At most a small accent (a piece of jewelry, a subtle trim) can echo the lens color; the outfit itself should never be a color-to-color match with the lenses, since that reads as styled/staged rather than an actual night out. Well-groomed hair, subtle styling, no other visible eyewear.

Framing: a tight head-and-shoulders portrait crop — head, neck, and top of the shoulders filling most of the frame, the same close zoom level every time, with the sunglasses large and clearly readable on the face. Crop just below the collarbone: no chest or décolletage on display, and if the wardrobe is low-cut or off-shoulder, crop tighter so it doesn't read that way. Shallow depth of field, with ${backdrop}. Nothing so busy it competes with the product.

Lighting and color: near-black, true-dark background — not gray, brown, or hazy — with strong, punchy contrast and vivid, saturated warm gold highlights on the skin. A moody, high-contrast editorial nightlife look: bright, crisp, clearly-defined key light hitting the face so skin tone, sunglasses, and jewelry pop with clarity, falling off into deep black shadow in the background. Never flat, muted, desaturated, sepia-washed, foggy, or soft-diffused — every generation should have the same punchy, saturated, deep-contrast color grade as a flash-lit editorial nightlife shot, not a dim or hazy ambient one.

Photography style: this must look like a real photograph taken on a professional camera at an actual party, not a rendered or AI-generated image. Natural skin texture with visible pores, fine lines, and subtle asymmetry — never airbrushed, waxy, or unnaturally smooth. Real directional lighting with natural shadow falloff, slight authentic film/sensor grain, imperfect flyaway hairs. Avoid the typical AI-image look entirely: no plastic-looking skin, no overly symmetrical features, no synthetic-looking background blur. Sharp focus on the face and sunglasses. No text, no logos, no watermarks.`;

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

/**
 * Refines an already-generated model photo using a free-text instruction
 * (e.g. "make the jacket red", "have her look straight at the camera") —
 * the /admin/master-inventory lightbox's "Apply Edit" action. Unlike
 * generateModelPhoto, the reference image here is the EXISTING generated
 * photo itself (not the product cutout), so Gemini edits in place rather
 * than starting over from the product reference.
 */
export async function editModelPhoto(options: {
  imageUrl: string;
  instructions: string;
  productName?: string;
  chapterSlug?: string;
}): Promise<string> {
  const geminiKey = await getSetting("IMAGE_GEN_API_KEY");
  if (!geminiKey) {
    throw new Error("IMAGE_GEN_API_KEY (Gemini) is not set — add it in /admin/settings first");
  }

  const prompt = `Here is a lifestyle photo of a model wearing a pair of sunglasses${
    options.productName ? ` ("${options.productName}")` : ""
  }.

Apply this edit: ${options.instructions.trim()}

Keep everything else about the photo — the model's identity, the sunglasses (frame shape, color, lens tint), the framing, and the overall lighting/mood — exactly as it is unless the edit explicitly asks to change it. No text, no logos, no watermarks.`;

  const base64Png = await generateWithGemini(geminiKey, prompt, [options.imageUrl], "portrait4x5");
  const url = await uploadGeneratedImage(base64Png, "model-photos");

  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("marketing_assets").insert({
      url,
      label: options.productName ? `${options.productName} — edited model` : "Edited model photo",
      tags: ["generated-model", "edited", ...(options.chapterSlug ? [options.chapterSlug] : [])],
    });
  } catch (err) {
    console.error("Failed to log edited model photo to marketing_assets", err);
  }

  return url;
}
