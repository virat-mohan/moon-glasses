import { NextResponse } from "next/server";
import { confirmUpiOrderPayment } from "@/lib/upi-payment";

/** Manual confirmation step — an admin checks their bank/UPI app (or a flagged screenshot in /admin/payment-confirmations) for the transfer, then clicks this. The only other path to "paid" is lib/payment-auto-confirm.ts's automatic match on a WhatsApp screenshot; this route is the human backstop for everything that doesn't clear that bar. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await confirmUpiOrderPayment(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Failed to confirm UPI payment", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not confirm payment" },
      { status: 400 }
    );
  }
}
