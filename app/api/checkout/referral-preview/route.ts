import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import { resolveReferralDiscount } from "@/lib/referrals";

/**
 * Live preview only, for the checkout total — the real charge is always
 * recomputed from scratch server-side in computeTrustedOrderTotal at
 * create-order/verify time, same as every other price input. This just lets
 * the shopper see the discount before paying instead of finding out only
 * after Razorpay opens.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const referralCode = String(body?.referralCode ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  if (!referralCode) return NextResponse.json({ valid: false, discountRupees: 0 });

  try {
    const customer = await getCurrentCustomer();
    const referral = await resolveReferralDiscount(referralCode, customer?.id ?? null, phone);
    if (!referral) return NextResponse.json({ valid: false, discountRupees: 0 });
    return NextResponse.json({ valid: true, discountRupees: referral.discountRupees });
  } catch (err) {
    console.error("Referral preview failed", err);
    return NextResponse.json({ valid: false, discountRupees: 0 });
  }
}
