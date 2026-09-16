import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { trackShiprocketShipment } from "@/lib/shiprocket";
import { applyShipmentStatusUpdate } from "@/lib/shiprocket-status";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select("shiprocket_shipment_id")
      .eq("id", id)
      .maybeSingle();
    if (!order?.shiprocket_shipment_id) {
      return NextResponse.json({ error: "No shipment on this order yet" }, { status: 400 });
    }

    const tracking = await trackShiprocketShipment(order.shiprocket_shipment_id);
    const shipmentStatus = tracking.status ? tracking.status.toLowerCase() : "processing";

    // Same transition-guarded logic the webhook and the polling cron use —
    // a manual refresh must never skip the RTO/NDR/delivered side-effects
    // just because a human clicked the button instead of Shiprocket calling in.
    if (tracking.status) {
      await applyShipmentStatusUpdate({
        orderId: id,
        status: tracking.status,
        awbCode: tracking.awbCode,
        courierName: tracking.courierName,
      });
    }

    return NextResponse.json({ ok: true, ...tracking, shipmentStatus });
  } catch (err) {
    console.error("Failed to track Shiprocket shipment", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check tracking" },
      { status: 500 }
    );
  }
}
