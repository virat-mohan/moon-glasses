import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createShiprocketReturnPickup } from "@/lib/shiprocket";
import { sendReturnApprovedEmail, sendReturnDeniedEmail } from "@/lib/email";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "action must be approve or deny" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: returnRequest } = await supabase
      .from("return_requests")
      .select("id, order_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!returnRequest) return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    if (returnRequest.status !== "requested") {
      return NextResponse.json({ error: `This request is already ${returnRequest.status}` }, { status: 400 });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, customer_email, delivery_address, delivery_city, delivery_state, delivery_pincode")
      .eq("id", returnRequest.order_id)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (action === "deny") {
      const denialReason = String(body?.denialReason ?? "Doesn't meet our return policy").trim();
      await supabase
        .from("return_requests")
        .update({ status: "denied", denial_reason: denialReason, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (order.customer_email) {
        await sendReturnDeniedEmail(order.customer_email, order.customer_name, order.id, denialReason);
      }
      return NextResponse.json({ ok: true, status: "denied" });
    }

    // approve
    if (!order.delivery_city || !order.delivery_state || !order.delivery_pincode) {
      return NextResponse.json(
        { error: "Order is missing city/state/pincode — this order predates structured addresses" },
        { status: 400 }
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("chapter_slug, chapter_name, unit_price, quantity")
      .eq("order_id", order.id);

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

    await supabase
      .from("return_requests")
      .update({ status: "approved", return_shipment_id: shipmentId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (order.customer_email) {
      await sendReturnApprovedEmail(order.customer_email, order.customer_name, order.id);
    }

    return NextResponse.json({ ok: true, status: "approved", shipmentId });
  } catch (err) {
    console.error("Failed to update return request", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update return request" },
      { status: 500 }
    );
  }
}
