import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Public (no session) — same unguessable-UUID capability-link pattern as
 * /invoice/[orderId] and /review/[orderId]. Backs the checkout confirmation
 * page's order summary, which needs to work for guest checkouts too.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, customer_name, total, subtotal, discount_amount, referral_discount_amount, shipping_charge, payment_type, cod_advance_amount, balance_due, payment_status, delivery_address, delivery_city, delivery_state, delivery_pincode"
      )
      .eq("id", id)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const { data: items } = await supabase
      .from("order_items")
      .select("chapter_name, unit_price, quantity")
      .eq("order_id", id);

    return NextResponse.json({ order, items: items ?? [] });
  } catch (err) {
    console.error("Failed to load order summary", id, err);
    return NextResponse.json({ error: "Could not load order" }, { status: 500 });
  }
}
