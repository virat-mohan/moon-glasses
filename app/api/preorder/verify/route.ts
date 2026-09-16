import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { markPreorderPaid } from "@/lib/preorders";
import { sendPreorderConfirmationEmail } from "@/lib/email";
import { getDropDateIso, formatDropDateLabel } from "@/lib/dropDate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  try {
    const valid = await verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });

    const preorder = await markPreorderPaid(razorpay_order_id, razorpay_payment_id);

    const dropDateLabel = formatDropDateLabel(await getDropDateIso());
    sendPreorderConfirmationEmail(preorder.email, preorder.name, preorder.amount_rupees, dropDateLabel).catch(
      (err) => console.error("Failed to send pre-order confirmation email", err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to verify pre-order payment", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not verify payment" },
      { status: 500 }
    );
  }
}
