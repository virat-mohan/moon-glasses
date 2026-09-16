import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getOrCreateReferralCode } from "@/lib/referrals";

/**
 * Public (no session needed) — the checkout confirmation page uses this so
 * a guest checkout (who now gets a real customer record, just no login
 * session) can still see their referral code right after ordering, not
 * only people who verify OTP and visit /account.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase.from("orders").select("customer_id").eq("id", id).maybeSingle();
    if (!order?.customer_id) return NextResponse.json({ referralCode: null });

    const referralCode = await getOrCreateReferralCode(order.customer_id);
    return NextResponse.json({ referralCode });
  } catch (err) {
    console.error("Failed to load referral code for order", err);
    return NextResponse.json({ referralCode: null });
  }
}
