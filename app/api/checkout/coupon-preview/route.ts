import { NextResponse } from "next/server";
import { resolveCouponDiscount } from "@/lib/coupons";

/**
 * Live preview only — the real charge is always recomputed from scratch
 * server-side in computeTrustedOrderTotal at create-order/verify time.
 * Same pattern as referral-preview.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const couponCode = String(body?.couponCode ?? "").trim();
  const subtotal = Number(body?.subtotal ?? 0);
  if (!couponCode || subtotal <= 0) return NextResponse.json({ valid: false, discountRupees: 0 });

  try {
    const coupon = await resolveCouponDiscount(couponCode, subtotal);
    if (!coupon) return NextResponse.json({ valid: false, discountRupees: 0 });
    return NextResponse.json({ valid: true, discountRupees: coupon.discountRupees });
  } catch (err) {
    console.error("Coupon preview failed", err);
    return NextResponse.json({ valid: false, discountRupees: 0 });
  }
}
