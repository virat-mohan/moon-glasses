import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { finalizeOrder, type OrderPayload } from "@/lib/order-fulfillment";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order } = body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order?.items?.length) {
    return NextResponse.json({ error: "Missing payment or order details" }, { status: 400 });
  }

  const payload = order as OrderPayload;

  try {
    const valid = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    if (!valid) {
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
    }

    const { orderId } = await finalizeOrder(payload, razorpay_order_id, razorpay_payment_id);
    return NextResponse.json({ orderId });
  } catch (err) {
    console.error("Failed to verify/save Razorpay order", err);
    return NextResponse.json({ error: "Could not complete order" }, { status: 500 });
  }
}
