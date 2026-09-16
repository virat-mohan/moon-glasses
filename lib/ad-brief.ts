import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import type { ChapterSales } from "@/lib/sales-metrics";

export type CreativeStyle = "ai_photo" | "real_photo_text_overlay";

export type AdBrief = {
  headline: string;
  primaryText: string;
  cta: string;
  targetAudience: string;
  imagePrompt: string;
  imagePrompts?: string[];
  creativeStyle?: CreativeStyle;
  overlayText?: string;
  hashtags: string[];
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Claude response did not contain JSON: ${text.slice(0, 300) || "(empty response)"}`);
  }
  return raw.slice(start, end + 1);
}

export type MultiChapterEntry = { name: string; sales?: ChapterSales };

export async function generateAdBrief(
  chapterName: string | null,
  sales?: ChapterSales,
  customInstructions?: string,
  isCarousel?: boolean,
  multiChapters?: MultiChapterEntry[]
): Promise<AdBrief> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");

  const brand = await getBrandProfile();

  const salesLine = sales
    ? `It sold ${sales.unitsSold} units and ₹${sales.revenue.toLocaleString("en-IN")} in revenue over the last 30 days — lean into "selling fast" energy if that number is strong.`
    : "No recent sales data is available for this product yet — write for cold-audience discovery instead of urgency.";

  const overrideLine = customInstructions
    ? `\nThe admin has given this specific direction for this brief — follow it, even if it overrides the default strategy above: "${customInstructions}"`
    : "";

  // A multi-chapter carousel showcases several distinct products, one per
  // card, in the exact order given — the copy should read as a collection
  // roundup rather than pitch a single product.
  const multiChapterLine =
    multiChapters && multiChapters.length > 0
      ? `This is a carousel showcasing ${multiChapters.length} different products from the collection, in this exact order:\n${multiChapters
          .map(
            (c, i) =>
              `${i + 1}. "${c.name}"${c.sales ? ` — sold ${c.sales.unitsSold} units, ₹${c.sales.revenue.toLocaleString("en-IN")} revenue in the last 30 days` : " — no recent sales data yet"}`
          )
          .join(
            "\n"
          )}\nWrite the headline/body as a collection roundup, not a pitch for any single one of them.`
      : "";

  // No chapter name means this is a generic brand post — not tied to one
  // product, and the link it eventually points to (set at launch time) is
  // the homepage/collection, not a single product page.
  const productLine = multiChapterLine
    ? multiChapterLine
    : chapterName
      ? `Product being promoted: "${chapterName}".\n${salesLine}`
      : `This is a generic brand awareness post — not about one specific product. Write about ${brand.brandName} as a whole (the collection, the "${brand.tagline}" idea, what makes the brand worth following), not any single Chapter/product by name.`;

  const prompt = `You are writing a Meta (Instagram/Facebook) ad brief for ${brand.brandName} ("${brand.tagline}"), a D2C brand selling a ${brand.productNoun}.

Brand voice: ${brand.voice}

${productLine}${overrideLine}

Return ONLY a JSON object, no commentary, in this exact shape:
{
  "headline": "string, under 40 characters, punchy",
  "primaryText": "string, 1-3 sentences, the actual ad body copy",
  "cta": "one of: SHOP_NOW, LEARN_MORE, SIGN_UP",
  "targetAudience": "one line describing who this ad should target (interests/demographics), for setting up Meta ad targeting",
  ${
    isCarousel
      ? multiChapters && multiChapters.length > 0
        ? `"imagePrompts": "an array of EXACTLY ${multiChapters.length} detailed visual scene descriptions for an image generator, in the SAME ORDER as the products listed above — card ${1} must be "${multiChapters[0]?.name}", and so on. Each should describe setting, lighting, mood and how that specific product should be worn/used. Do not describe any on-image text, headline or logo — clean lifestyle photos with no text baked in."`
        : `"imagePrompts": "an array of detailed visual scene descriptions for an image generator, one per carousel card — YOU decide how many cards this ad actually needs (Meta allows 2 to 10; most ads work best with 3-6), each a distinct angle/setting/moment (never near-identical shots), together telling a small visual story or showing the product from different real-world contexts. Do not pad to a round number — stop once the story is told. Describe setting, lighting, mood and how the product should be worn/used in each. Do not describe any on-image text, headline or logo — clean lifestyle photos with no text baked in."`
      : `"imagePrompt": "a detailed visual scene description for an image generator — describe the setting, lighting, mood and how the product should be worn/used. Do not describe any on-image text, headline or logo — the image should be a clean lifestyle photo with no text baked in.",
  "creativeStyle": "one of: ai_photo, real_photo_text_overlay — YOU decide which creative approach actually fits this specific ad, don't default to one. Pick real_photo_text_overlay for promotional/urgent/announcement-driven angles (a strong sales number to lean into, a new drop, a limited-time or scarcity angle, a direct-response feel) — real product photography with bold on-image text reads as more authentic and converts better for that kind of push. Pick ai_photo for aspirational/editorial/brand-story angles where a clean, text-free lifestyle photo feels more premium and sits more naturally in an Instagram feed.",
  "overlayText": "ONLY meaningful when creativeStyle is real_photo_text_overlay: a short, bold line of on-image text, under 6 words (e.g. 'NEW DROP' or 'SELLING FAST' or 'BACK IN STOCK') to render directly on top of the photo. Leave as an empty string when creativeStyle is ai_photo."`
  },
  "hashtags": ["array of 8-15 relevant Instagram hashtags as plain strings without the # symbol, mixing broad reach tags (e.g. streetwear, travel) with niche/branded ones (e.g. the brand name, product name) — ready to prefix with # and post"]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  // Sonnet 5 returns extended-thinking content first — content[0] is a
  // "thinking" block, not the text, so the actual JSON is wherever the
  // "text"-typed block ends up, never reliably at a fixed index.
  const text = data.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text ?? "";
  const parsed = JSON.parse(extractJson(text));

  return {
    headline: parsed.headline,
    primaryText: parsed.primaryText,
    cta: parsed.cta,
    targetAudience: parsed.targetAudience,
    imagePrompt: parsed.imagePrompt ?? "",
    imagePrompts: Array.isArray(parsed.imagePrompts) ? parsed.imagePrompts.slice(0, 10) : undefined,
    creativeStyle: parsed.creativeStyle === "real_photo_text_overlay" ? "real_photo_text_overlay" : "ai_photo",
    overlayText: typeof parsed.overlayText === "string" ? parsed.overlayText : undefined,
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
  };
}

export type AdBriefCopy = {
  headline: string;
  primaryText: string;
  cta: string;
  targetAudience: string;
  hashtags: string[];
};

/**
 * Revises an already-generated brief's copy against a free-text instruction
 * ("make it punchier", "mention the 10% off code", "lean into Diwali") —
 * unlike generateAdBrief, this doesn't write from scratch: it hands Claude
 * the CURRENT copy and asks for a revised version, so anything not touched
 * by the instruction stays consistent instead of drifting on every pass.
 * Only the copy fields change — image_prompt(s)/creative_style/overlay_text
 * are left alone, since a copy edit shouldn't silently redo the visual.
 */
export async function reviseAdBriefCopy(current: AdBriefCopy, instruction: string): Promise<AdBriefCopy> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — add it in /admin/settings first");

  const brand = await getBrandProfile();

  const prompt = `You are revising an existing Meta (Instagram/Facebook) ad brief for ${brand.brandName} ("${brand.tagline}"), a D2C brand selling a ${brand.productNoun}.

Brand voice: ${brand.voice}

Current brief:
Headline: "${current.headline}"
Body: "${current.primaryText}"
CTA: ${current.cta}
Target audience: ${current.targetAudience}
Hashtags: ${current.hashtags.join(", ")}

The admin wants this specific change: "${instruction}"

Apply that instruction. Keep everything else about the brief's voice and intent as close to the original as makes sense — this is a revision, not a rewrite from scratch. Return ONLY a JSON object, no commentary, in this exact shape:
{
  "headline": "string, under 40 characters, punchy",
  "primaryText": "string, 1-3 sentences, the actual ad body copy",
  "cta": "one of: SHOP_NOW, LEARN_MORE, SIGN_UP",
  "targetAudience": "one line describing who this ad should target (interests/demographics), for setting up Meta ad targeting",
  "hashtags": ["array of 8-15 relevant Instagram hashtags as plain strings without the # symbol"]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text ?? "";
  const parsed = JSON.parse(extractJson(text));

  return {
    headline: parsed.headline,
    primaryText: parsed.primaryText,
    cta: parsed.cta,
    targetAudience: parsed.targetAudience,
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
  };
}
