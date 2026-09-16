import { NextResponse } from "next/server";
import { shipOrder } from "@/lib/order-shipping";

/**
 * Manual "Ship" button — used to retry shipping an order that auto-ship
 * (finalizeOrder, right after checkout) skipped or failed on, e.g. an order
 * placed before structured addresses existed, or a Shiprocket outage at
 * checkout time.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await shipOrder(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Failed to create Shiprocket shipment", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create shipment" },
      { status: 500 }
    );
  }
}
