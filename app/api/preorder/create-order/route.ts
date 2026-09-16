import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay";
import { createPendingPreorder, getPreorderAmountRupees } from "@/lib/preorders";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;

  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Name and a valid email are required" }, { status: 400 });
  }

  try {
    const amountRupees = await getPreorderAmountRupees();
    const { razorpayOrderId, keyId } = await createRazorpayOrder(
      amountRupees,
      `moonglasses_preorder_${Date.now()}`
    );

    await createPendingPreorder({
      name,
      email,
      phone,
      chapterSlug: typeof body?.chapterSlug === "string" ? body.chapterSlug : null,
      amountRupees,
      razorpayOrderId,
    });

    return NextResponse.json({ razorpayOrderId, keyId, amountRupees });
  } catch (err) {
    console.error("Failed to create pre-order", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start pre-order" },
      { status: 500 }
    );
  }
}
