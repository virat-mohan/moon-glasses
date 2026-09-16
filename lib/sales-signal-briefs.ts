import { getSupabaseServerClient } from "@/lib/supabase";
import { getChapterSalesInRange } from "@/lib/sales-metrics";
import { generateAdBrief } from "@/lib/ad-brief";

const SELLING_FAST_UNITS = 5; // units in the trailing 7 days to count as "selling fast"
const COOLING_OFF_MIN_PRIOR_UNITS = 5; // prior week must have had real volume, not just noise
const COOLING_OFF_DROP_RATIO = 0.5; // this week's units must be ≤ half of the prior week's to count

const SIGNAL_INSTRUCTIONS: Record<"selling_fast" | "cooling_off", string> = {
  selling_fast:
    "This product is genuinely selling fast this week — lean into real urgency and social proof (e.g. limited stock, high demand), not generic hype.",
  cooling_off:
    "Sales for this product have cooled off noticeably compared to last week — write a fresh re-engagement angle (a new use-case, a different emotional hook, a reminder) rather than urgency, since urgency won't ring true for a product that isn't currently in high demand.",
};

/**
 * Drafts (never launches) an ad brief for any chapter whose weekly sales
 * just crossed a "selling fast" or "cooling off" threshold — the automated
 * half of "generate marketing based on sales." Stays a draft in
 * /admin/ad-briefs for one-tap human review; nothing here spends money or
 * posts anything on its own. Guarded against re-drafting the same
 * chapter+signal every day by checking for a recent auto-generated brief
 * first.
 */
export async function runSalesSignalBriefSweep() {
  const supabase = getSupabaseServerClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [thisWeek, priorWeek] = await Promise.all([
    getChapterSalesInRange(weekAgo.toISOString(), now.toISOString()),
    getChapterSalesInRange(twoWeeksAgo.toISOString(), weekAgo.toISOString()),
  ]);
  const priorBySlug = new Map(priorWeek.map((s) => [s.chapterSlug, s]));

  const drafted: { chapterSlug: string; signal: string }[] = [];
  const skipped: { chapterSlug: string; signal: string; reason: string }[] = [];

  async function alreadyDraftedRecently(chapterSlug: string, signal: string) {
    const { data } = await supabase
      .from("ad_briefs")
      .select("id")
      .eq("chapter_slug", chapterSlug)
      .eq("sales_signal", signal)
      .eq("auto_generated", true)
      .gte("created_at", weekAgo.toISOString())
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  async function draftBrief(chapterSlug: string, chapterName: string, signal: "selling_fast" | "cooling_off", sales: { unitsSold: number; revenue: number }) {
    if (await alreadyDraftedRecently(chapterSlug, signal)) {
      skipped.push({ chapterSlug, signal, reason: "already drafted this week" });
      return;
    }
    try {
      const brief = await generateAdBrief(
        chapterName,
        { chapterSlug, chapterName, unitsSold: sales.unitsSold, revenue: sales.revenue },
        SIGNAL_INSTRUCTIONS[signal],
        false
      );
      await supabase.from("ad_briefs").insert({
        chapter_slug: chapterSlug,
        headline: brief.headline,
        primary_text: brief.primaryText,
        cta: brief.cta,
        target_audience: brief.targetAudience,
        is_carousel: false,
        image_prompt: brief.imagePrompt,
        creative_style: brief.creativeStyle ?? "ai_photo",
        overlay_text: brief.overlayText || null,
        hashtags: brief.hashtags,
        auto_generated: true,
        sales_signal: signal,
      });
      drafted.push({ chapterSlug, signal });
    } catch (err) {
      skipped.push({ chapterSlug, signal, reason: err instanceof Error ? err.message : "generation failed" });
    }
  }

  for (const sale of thisWeek) {
    if (sale.unitsSold >= SELLING_FAST_UNITS) {
      await draftBrief(sale.chapterSlug, sale.chapterName, "selling_fast", sale);
      continue;
    }
    const prior = priorBySlug.get(sale.chapterSlug);
    if (
      prior &&
      prior.unitsSold >= COOLING_OFF_MIN_PRIOR_UNITS &&
      sale.unitsSold <= prior.unitsSold * COOLING_OFF_DROP_RATIO
    ) {
      await draftBrief(sale.chapterSlug, sale.chapterName, "cooling_off", sale);
    }
  }

  return { drafted, skipped };
}
