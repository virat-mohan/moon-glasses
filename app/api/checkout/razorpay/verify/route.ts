import { NextResponse } from "next/server";
import { RAZORPAY_DISABLED_MESSAGE } from "@/lib/checkout-rules";

// Storefront checkout is UPI only (founder decision, 2 Oct 2026). Razorpay is
// refused server-side whatever the settings say, so a stale or tampered client
// can't start or complete a card payment. The Razorpay webhook stays in place
// for refunds and for recovering any payment taken before this switch.
export async function POST() {
  return NextResponse.json({ error: RAZORPAY_DISABLED_MESSAGE }, { status: 410 });
}
