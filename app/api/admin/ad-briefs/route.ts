import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdBrief } from "@/lib/ad-brief";
import { getTopSellingChapters } from "@/lib/sales-metrics";
import { chapters } from "@/lib/chapters";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("ad_briefs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ briefs: data ?? [] });
  } catch (err) {
    console.error("Failed to list ad briefs", err);
    return NextResponse.json({ briefs: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chapterSlugs: string[] | undefined =
    Array.isArray(body?.chapterSlugs) && body.chapterSlugs.length > 0 ? body.chapterSlugs : undefined;
  // Pre-selected real photos from the asset library — when given, the brief
  // is written as copy to go around these exact images, skipping AI image
  // generation entirely. Multiple assets always means a carousel (one asset
  // per card), regardless of the isCarousel toggle.
  const assetUrls: string[] | undefined =
    Array.isArray(body?.assetUrls) && body.assetUrls.length > 0 ? body.assetUrls : undefined;
  if (!body?.isGeneric && !body?.chapterSlug && !chapterSlugs) {
    return NextResponse.json(
      { error: "Missing chapterSlug/chapterSlugs (or set isGeneric for a brand-wide post)" },
      { status: 400 }
    );
  }
  if (chapterSlugs && !body?.isCarousel) {
    return NextResponse.json({ error: "Multiple chapters only makes sense for a carousel" }, { status: 400 });
  }

  try {
    const isGeneric = !!body.isGeneric;
    const isCarousel = !!body.isCarousel || (assetUrls?.length ?? 0) > 1;
    const allSales = chapterSlugs || !isGeneric ? await getTopSellingChapters(30) : undefined;

    const assetInstructions = assetUrls
      ? `\nThe creative is already decided — ${assetUrls.length} real product photo${assetUrls.length > 1 ? "s" : ""} chosen from the asset library. Write copy to go around ${assetUrls.length > 1 ? "these exact photos, one per carousel card, in the order given" : "this exact photo"} — don't describe or reference generating an image.`
      : "";
    const customInstructions = ((body.customInstructions || "") + assetInstructions).trim() || undefined;

    let brief;
    if (chapterSlugs) {
      const multiChapters = chapterSlugs.map((slug) => ({
        name: chapters.find((c) => c.slug === slug)?.name ?? slug,
        sales: allSales?.find((s) => s.chapterSlug === slug),
      }));
      brief = await generateAdBrief(null, undefined, customInstructions, true, multiChapters);
    } else {
      const chapter = isGeneric ? null : chapters.find((c) => c.slug === body.chapterSlug);
      const chapterName = isGeneric ? null : (chapter?.name ?? body.chapterSlug);
      const sales = isGeneric ? undefined : allSales?.find((s) => s.chapterSlug === body.chapterSlug);
      brief = await generateAdBrief(chapterName, sales, customInstructions, isCarousel);
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("ad_briefs")
      .insert({
        chapter_slug: chapterSlugs || isGeneric ? null : body.chapterSlug,
        chapter_slugs: chapterSlugs ?? null,
        headline: brief.headline,
        primary_text: brief.primaryText,
        cta: brief.cta,
        target_audience: brief.targetAudience,
        is_carousel: isCarousel,
        image_prompt: isCarousel || assetUrls ? null : brief.imagePrompt,
        image_prompts: isCarousel && !assetUrls ? (brief.imagePrompts ?? null) : null,
        creative_style: isCarousel || assetUrls ? null : (brief.creativeStyle ?? "ai_photo"),
        overlay_text: isCarousel || assetUrls ? null : (brief.overlayText || null),
        hashtags: brief.hashtags,
        image_url: assetUrls && assetUrls.length === 1 ? assetUrls[0] : null,
        image_urls: assetUrls && assetUrls.length > 1 ? assetUrls : null,
        image_source: assetUrls ? "real" : null,
        // A multi-chapter carousel is carousel by construction — resolved
        // immediately. Anything else starts undecided: /admin/ad-briefs
        // shows the asset-picker + static/carousel choice before the full
        // creative UI, unless assetUrls were already given (then the
        // format's already implied by how many were picked).
        creative_format: chapterSlugs ? "carousel" : assetUrls ? (isCarousel ? "carousel" : "static") : null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ brief: data });
  } catch (err) {
    console.error("Failed to generate ad brief", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate ad brief" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: Record<string, string | string[] | boolean> = {};
  if (body.headline != null) patch.headline = body.headline;
  if (body.primaryText != null) patch.primary_text = body.primaryText;
  if (body.cta != null) patch.cta = body.cta;
  if (body.targetAudience != null) patch.target_audience = body.targetAudience;
  if (body.hashtags != null) patch.hashtags = body.hashtags;
  if (body.imageUrl != null) patch.image_url = body.imageUrl;
  if (body.imageUrls != null) patch.image_urls = body.imageUrls;
  if (body.imageSource != null) patch.image_source = body.imageSource;
  if (body.status != null) patch.status = body.status;
  if (body.isCarousel != null) patch.is_carousel = body.isCarousel;
  if (body.creativeFormat != null) patch.creative_format = body.creativeFormat;

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("ad_briefs").update(patch).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update ad brief", err);
    return NextResponse.json({ error: "Could not update ad brief" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("ad_briefs").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete ad brief", id, err);
    return NextResponse.json({ error: "Could not delete ad brief" }, { status: 500 });
  }
}
