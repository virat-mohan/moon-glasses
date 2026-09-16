import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdBrief } from "@/lib/ad-brief";
import { getTopSellingChapters } from "@/lib/sales-metrics";
import { chapters } from "@/lib/chapters";

/**
 * Confirms the assets + static/carousel decision for a brief created
 * without one yet (see creative_format on ad_briefs) — the step between
 * "brief is written" and "creative gets built", matching a strategist's
 * actual order of operations (message first, then pick source photos, then
 * decide the format they call for).
 *
 * Static: any picked asset becomes the image directly (image_prompt from
 * brief creation is still there for "Generate With AI" as an alternative).
 * Carousel with 2+ picked assets: those become the cards directly, one
 * asset per card, no AI needed. Carousel with fewer than 2: there's no
 * per-card image_prompts yet (those only exist when carousel was decided
 * at brief-creation time), so this re-runs generation in carousel mode to
 * get them — copy is regenerated too, since Claude writes carousel copy
 * holistically against the card sequence.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body?.id;
  const format = body?.format;
  const assetUrls: string[] = Array.isArray(body?.assetUrls) ? body.assetUrls : [];
  if (!id || (format !== "static" && format !== "carousel" && format !== "story")) {
    return NextResponse.json({ error: "Missing id or format (static|carousel|story)" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: existing, error: fetchError } = await supabase
      .from("ad_briefs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    if (format === "static" || format === "story") {
      // A Story is a single image, same as Static — just tracked under its
      // own creative_format so the admin UI can lead with "Post To Story"
      // for it instead of the feed-post flow.
      const patch: Record<string, string | boolean | null> = {
        creative_format: format,
        is_carousel: false,
      };
      if (assetUrls.length > 0) {
        patch.image_url = assetUrls[0];
        patch.image_source = "real";
      }
      const { error } = await supabase.from("ad_briefs").update(patch).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true, brief: { ...existing, ...patch } });
    }

    // format === "carousel"
    if (assetUrls.length >= 2) {
      const patch = {
        creative_format: "carousel",
        is_carousel: true,
        image_urls: assetUrls,
        image_source: "real",
      };
      const { error } = await supabase.from("ad_briefs").update(patch).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true, brief: { ...existing, ...patch } });
    }

    // Fewer than 2 assets picked for a carousel — need Claude to write fresh
    // carousel copy + per-card image prompts, since those don't exist yet.
    const chapter = existing.chapter_slug ? chapters.find((c) => c.slug === existing.chapter_slug) : null;
    const chapterName = existing.chapter_slug ? (chapter?.name ?? existing.chapter_slug) : null;
    const sales = existing.chapter_slug ? (await getTopSellingChapters(30)).find((s) => s.chapterSlug === existing.chapter_slug) : undefined;
    const regenerated = await generateAdBrief(chapterName, sales, undefined, true);

    const patch = {
      creative_format: "carousel",
      is_carousel: true,
      headline: regenerated.headline,
      primary_text: regenerated.primaryText,
      cta: regenerated.cta,
      target_audience: regenerated.targetAudience,
      hashtags: regenerated.hashtags,
      image_prompts: regenerated.imagePrompts ?? null,
      image_prompt: null,
      creative_style: null,
      overlay_text: null,
      image_url: assetUrls[0] ?? null,
      image_urls: assetUrls.length > 0 ? assetUrls : null,
      image_source: assetUrls.length > 0 ? "real" : null,
    };
    const { error } = await supabase.from("ad_briefs").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, brief: { ...existing, ...patch } });
  } catch (err) {
    console.error("Failed to set ad brief format", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not set format" },
      { status: 500 }
    );
  }
}
