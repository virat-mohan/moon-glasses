import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Queues (or cancels) a brief for the cron in app/api/cron/publish-queue to
 * auto-post or auto-launch at scheduledFor. Launch-specific attributes
 * (budget/CTA/targeting) are saved here so the cron has everything it needs
 * without a human present.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (body.cancel) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("ad_briefs")
      .update({ scheduled_for: null, scheduled_action: null, queue_status: "none", queue_error: null })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: "Could not cancel schedule" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.scheduledFor || !body.scheduledAction) {
    return NextResponse.json({ error: "Missing scheduledFor or scheduledAction" }, { status: 400 });
  }
  if (!["post", "launch"].includes(body.scheduledAction)) {
    return NextResponse.json({ error: "scheduledAction must be post or launch" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    scheduled_for: new Date(body.scheduledFor).toISOString(),
    scheduled_action: body.scheduledAction,
    queue_status: "queued",
    queue_error: null,
  };
  if (body.scheduledAction === "launch") {
    if (body.dailyBudgetRupees != null) patch.ad_daily_budget_rupees = body.dailyBudgetRupees;
    if (body.cta) patch.ad_cta_override = body.cta;
    if (body.ageMin != null) patch.ad_age_min = body.ageMin;
    if (body.ageMax != null) patch.ad_age_max = body.ageMax;
    if (body.gender) patch.ad_gender = body.gender;
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("ad_briefs").update(patch).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to schedule ad brief", err);
    return NextResponse.json({ error: "Could not schedule brief" }, { status: 500 });
  }
}
