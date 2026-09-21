import { NextResponse } from "next/server";
import { createUpiOrder } from "@/lib/upi-payment";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.customer || !body?.items?.length) {
    return NextResponse.json({ error: "Missing customer or items" }, { status: 400 });
  }

  try {
    const result = await createUpiOrder({
      customer: body.customer,
      items: body.items,
      isGift: body.isGift,
      giftNote: body.giftNote,
      sessionKey: body.sessionKey,
      redeemMilesRupees: body.redeemMilesRupees,
      newsletterOptIn: body.newsletterOptIn,
      referralCode: body.referralCode,
      couponCode: body.couponCode,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to create UPI order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create your order" },
      { status: 400 }
    );
  }
}
