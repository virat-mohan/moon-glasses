import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { postBriefToInstagram, launchBriefCampaign } from "@/lib/ad-brief-publish";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/** Sweeps ad_briefs queued for a future post/launch whose time has come. */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: due, error } = await supabase
    .from("ad_briefs")
    .select("id, scheduled_action, ad_daily_budget_rupees, ad_cta_override, ad_age_min, ad_age_max, ad_gender")
    .eq("queue_status", "queued")
    .lte("scheduled_for", new Date().toISOString());
  if (error) {
    console.error("Failed to load queued ad briefs", error);
    return NextResponse.json({ error: "Could not load queue" }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const brief of due ?? []) {
    try {
      if (brief.scheduled_action === "launch") {
        await launchBriefCampaign(brief.id, {
          dailyBudgetRupees: brief.ad_daily_budget_rupees ?? 500,
          cta: brief.ad_cta_override || undefined,
          targeting: { ageMin: brief.ad_age_min, ageMax: brief.ad_age_max, gender: brief.ad_gender },
        });
      } else {
        await postBriefToInstagram(brief.id);
      }
      results.push({ id: brief.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to publish queued brief ${brief.id}`, err);
      await supabase.from("ad_briefs").update({ queue_status: "failed", queue_error: message }).eq("id", brief.id);
      results.push({ id: brief.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
