import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { retargetOneSession, retargetUnpaidUpiOrders } from "@/lib/abandoned-cart";

const STAGE_1_AFTER_MINUTES = 5; // plain reminder

/**
 * Abandoned-cart & unpaid-order sweep sequence:
 *  1. 5 minutes idle -> plain WhatsApp/email reminder (retargetOneSession).
 *  2. Unpaid orders recovery -> shoppers who filled address, reached UPI payment screen, but dropped off (retargetUnpaidUpiOrders).
 *
 * IMPORTANT: this only fires as often as this route is actually hit.
 * Vercel's free/Hobby plan caps Cron at once a day, which can't deliver
 * 5-minute precision — /admin/abandoned-carts' "Send Nudge" button
 * calls the same underlying functions for manual/immediate testing, but for
 * this to run on its intended schedule in production, either upgrade to
 * Vercel Pro (arbitrary cron frequency) or have an external scheduler
 * (e.g. cron-job.org, free) hit this URL with ?secret=<CRON_SECRET> every
 * few minutes.
 */
export async function GET(request: Request) {
  if (!(await isCronAuthorized(request))) {
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

    // Unpaid orders recovery — shoppers who filled address, reached UPI payment screen, but dropped off
    const unpaidRecovery = await retargetUnpaidUpiOrders(10, 24);

    return NextResponse.json({
      abandoned: staleSessions?.length ?? 0,
      stage1Sent,
      unpaidEligible: unpaidRecovery.eligible,
      unpaidSent: unpaidRecovery.sent,
    });
  } catch (err) {
    console.error("Abandon sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
