import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendBarterChargeLinkEmail } from "@/lib/email";

async function assertAuthorized(request: Request) {
  const secret = await getSetting("CRON_SECRET");
  if (!secret) return true;
  const provided = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

/**
 * Enforces the binding condition a gift_first shopper accepted at checkout
 * (see barter_terms_accepted_at): post within 12 hours of delivery, or get
 * charged full price. barter_charge_deadline_at is set the moment
 * Shiprocket confirms delivery (see lib/shiprocket-status.ts) — this just
 * finds orders whose deadline has passed with no post link submitted and no
 * charge link sent yet, and sends the one-time email with the payment link
 * (app/barter/[orderId]/pay). Idempotent via barter_charge_link_sent_at —
 * safe to run as often as the cron schedule allows.
 *
 * Note: Vercel's Hobby plan only runs crons once a day regardless of the
 * schedule string in vercel.json — a 12-hour deadline is only enforced as
 * promptly as this actually fires, which on Hobby means up to ~24h late.
 * Upgrading to Pro (or triggering this externally on a tighter schedule)
 * closes that gap.
 */
export async function GET(request: Request) {
  if (!(await assertAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: overdue, error } = await supabase
    .from("orders")
    .select("id, customer_name, customer_email, total")
    .eq("is_post_barter", true)
    .eq("barter_tier", "gift_first")
    .is("barter_post_url", null)
    .is("barter_charge_link_sent_at", null)
    .not("barter_charge_deadline_at", "is", null)
    .lte("barter_charge_deadline_at", new Date().toISOString())
    .limit(100);
  if (error) {
    console.error("barter-charge-sweep query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const order of overdue ?? []) {
    try {
      if (order.customer_email) {
        await sendBarterChargeLinkEmail(order.customer_email, order.customer_name, order.id, order.total);
      }
      await supabase.from("orders").update({ barter_charge_link_sent_at: new Date().toISOString() }).eq("id", order.id);
      sent++;
    } catch (err) {
      console.error("Failed to send barter charge link", order.id, err);
    }
  }

  return NextResponse.json({ checked: overdue?.length ?? 0, sent });
}
