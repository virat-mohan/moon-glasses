import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createShiprocketReturnPickup } from "@/lib/shiprocket";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.return_shipment_id) {
      return NextResponse.json({ error: "A return pickup is already scheduled for this order" }, { status: 400 });
    }
    if (!order.delivery_city || !order.delivery_state || !order.delivery_pincode) {
      return NextResponse.json(
        { error: "Order is missing city/state/pincode — this order predates structured addresses" },
        { status: 400 }
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("chapter_slug, chapter_name, unit_price, quantity")
      .eq("order_id", id);

    const { shipmentId } = await createShiprocketReturnPickup({
      orderId: order.id,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      addressLine: order.delivery_address,
      city: order.delivery_city,
      state: order.delivery_state,
      pincode: order.delivery_pincode,
      items: (items ?? []).map((item) => ({
        name: item.chapter_name,
        sku: item.chapter_slug,
        quantity: item.quantity,
        price: item.unit_price,
      })),
    });

    const { error } = await supabase.from("orders").update({ return_shipment_id: shipmentId }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, shipmentId });
  } catch (err) {
    console.error("Failed to create return pickup", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not schedule return pickup" },
      { status: 500 }
    );
  }
}
