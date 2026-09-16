import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { retargetOneSession, sendSecondNudgeForSession } from "@/lib/abandoned-cart";

const STAGE_1_AFTER_MINUTES = 5; // first plain reminder
const STAGE_2_AFTER_STAGE_1_MINUTES = 120; // BUYNOW10 coupon nudge, 2 hours after stage 1

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true; // not configured yet — allow (dev/manual-trigger friendly)
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/**
 * Two-stage abandoned-cart sequence:
 *  1. 5 minutes idle -> plain WhatsApp/email reminder (retargetOneSession).
 *  2. 2 hours after stage 1, still not converted -> a BUYNOW10 coupon nudge
 *     (sendSecondNudgeForSession) to actually push the sale.
 *
 * IMPORTANT: this only fires as often as this route is actually hit.
 * Vercel's free/Hobby plan caps Cron at once a day, which can't deliver
 * 5-minute/2-hour precision — /admin/abandoned-carts' "Send Nudge" button
 * calls the same underlying functions for manual/immediate testing, but for
 * this to run on its intended schedule in production, either upgrade to
 * Vercel Pro (arbitrary cron frequency) or have an external scheduler
 * (e.g. cron-job.org, free) hit this URL with ?secret=<CRON_SECRET> every
 * few minutes.
 */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Stage 1 — mark idle active carts abandoned, send the plain reminder.
    const stage1Before = new Date(Date.now() - STAGE_1_AFTER_MINUTES * 60 * 1000).toISOString();
    const { data: staleSessions, error } = await supabase
      .from("cart_sessions")
      .update({ status: "abandoned" })
      .eq("status", "active")
      .lt("last_activity_at", stage1Before)
      .select();
    if (error) throw error;

    let stage1Sent = 0;
    for (const session of staleSessions ?? []) {
      if (session.retargeted_at) continue;
      const { whatsappSent, emailSent } = await retargetOneSession(session);
      if (whatsappSent || emailSent) stage1Sent++;
    }

    // Stage 2 — already nudged once, 2+ hours ago, never converted, never
    // sent the coupon nudge yet.
    const stage2Before = new Date(Date.now() - STAGE_2_AFTER_STAGE_1_MINUTES * 60 * 1000).toISOString();
    const { data: dueForStage2 } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("status", "abandoned")
      .not("retargeted_at", "is", null)
      .lt("retargeted_at", stage2Before)
      .is("second_nudge_sent_at", null);

    let stage2Sent = 0;
    for (const session of dueForStage2 ?? []) {
      const { whatsappSent, emailSent } = await sendSecondNudgeForSession(session);
      if (whatsappSent || emailSent) stage2Sent++;
    }

    return NextResponse.json({
      abandoned: staleSessions?.length ?? 0,
      stage1Sent,
      stage2Eligible: dueForStage2?.length ?? 0,
      stage2Sent,
    });
  } catch (err) {
    console.error("Abandon sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
