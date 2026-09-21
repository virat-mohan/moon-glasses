import { NextResponse } from "next/server";
import { confirmUpiOrderPayment } from "@/lib/upi-payment";

/** Manual confirmation step — an admin checks their bank/UPI app for the transfer, then clicks this. No webhook exists for a raw UPI transfer, so this is the only thing that ever moves a upi_qr order from unpaid to paid. */
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
