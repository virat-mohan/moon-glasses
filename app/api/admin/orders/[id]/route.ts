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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServerClient();

    const { data: order } = await supabase.from("orders").select("id, customer_name").eq("id", id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Helper to safely delete child rows from a table without aborting on empty/missing relations
    const safeDelete = async (table: string, column = "order_id") => {
      try {
        const { error } = await supabase.from(table).delete().eq(column, id);
        if (error) console.warn(`Notice deleting from ${table}:`, error.message);
      } catch (e) {
        console.warn(`Error deleting from ${table}:`, e);
      }
    };

    // Helper to safely nullify optional references
    const safeUnlink = async (table: string, column: string) => {
      try {
        const { error } = await supabase.from(table).update({ [column]: null }).eq(column, id);
        if (error) console.warn(`Notice unlinking ${table}.${column}:`, error.message);
      } catch (e) {
        console.warn(`Error unlinking ${table}.${column}:`, e);
      }
    };

    // Delete child records that reference this order
    await safeDelete("whatsapp_messages");
    await safeDelete("shipping_labels");
    await safeDelete("shipments");
    await safeDelete("order_side_effects");
    await safeDelete("order_history");
    await safeDelete("order_events");
    await safeDelete("return_requests");
    await safeDelete("order_items");
    await safeDelete("pwap_post_kits");
    await safeDelete("pwap_rewards", "barter_order_id");
    await safeDelete("loyalty_ledger");
    await safeDelete("referrals", "referred_order_id");
    await safeDelete("reviews");
    await safeDelete("coupon_redemptions");
    await safeDelete("discount_rule_redemptions");

    // Unlink any optional foreign keys that reference this order
    await safeUnlink("legacy_customers", "converted_order_id");
    await safeUnlink("preorders", "converted_order_id");

    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error("Failed to delete order", err);
    return NextResponse.json({ error: "Could not delete order" }, { status: 500 });
  }
}
