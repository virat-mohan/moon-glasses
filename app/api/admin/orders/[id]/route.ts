import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  // refund_status is intentionally not editable here — it's set only by an
  // actual refund/cancel firing or the courier-status webhook confirming
  // money moved, so hand-editing it would let the label lie about whether
  // money actually moved.
  const patch: Record<string, string> = {};
  if (body.status) patch.status = body.status;
  // shipmentStatus is a plain label overwrite, not routed through
  // applyShipmentStatusUpdate — Shiprocket's own webhook/tracking sweep is
  // the sole trigger for review-request nudges, refunds, and restocking.
  // This dropdown is for record-keeping on orders shipped outside that flow
  // (or while tracking lags), and must never double-fire those side effects
  // if the real webhook later reports the same transition.
  if (body.shipmentStatus) patch.shipment_status = body.shipmentStatus;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update order", err);
    return NextResponse.json({ error: "Could not update order" }, { status: 500 });
  }
}
