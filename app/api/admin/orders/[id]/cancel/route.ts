import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { cancelShiprocketOrder } from "@/lib/shiprocket";
import { refundRazorpayPayment } from "@/lib/razorpay";

const CANCELLABLE_SHIPMENT_STATUSES = new Set(["not_shipped", "processing"]);

/**
 * Pre-shipment cancellation only — full refund + restock, no Shiprocket
 * cancel call needed if it was never shipped, otherwise cancels the
 * Shiprocket order too. Once a shipment is picked up this route refuses:
 * nothing can reliably recall it in transit, so that case has to go through
 * refuse-at-door (RTO, already automated) or a post-delivery return instead.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = getSupabaseServerClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.status === "cancelled") {
      return NextResponse.json({ error: "This order is already cancelled." }, { status: 400 });
    }
    if (!CANCELLABLE_SHIPMENT_STATUSES.has(order.shipment_status)) {
      return NextResponse.json(
        {
          error:
            "This order has already been picked up — it can't be reliably recalled. Ask the customer to refuse it at the door (becomes an RTO, refunded automatically) or request a return once it arrives.",
        },
        { status: 400 }
      );
    }

    if (order.shiprocket_order_id) {
      try {
        await cancelShiprocketOrder(order.shiprocket_order_id);
      } catch (err) {
        console.error("Shiprocket cancel failed, proceeding with local cancellation anyway", id, err);
      }
    }

    // A refund failure (e.g. Razorpay account balance too low to process
    // it) must never block cancellation itself — the order still needs to
    // stop being fulfilled and its stock still needs to come back,
    // independent of whether Razorpay could move money right now. Same
    // resilience pattern as the RTO auto-refund in lib/shiprocket-status.ts.
    const alreadyRefunded = order.refunded_amount ?? 0;
    const refundRupees = Math.max(0, order.total - alreadyRefunded);
    let refundedRupees = 0;
    let refundError: string | null = null;

    if (refundRupees > 0 && order.razorpay_payment_id) {
      try {
        const refund = await refundRazorpayPayment(order.razorpay_payment_id, refundRupees);
        refundedRupees = refund.amountRupees;
        await supabase
          .from("orders")
          .update({
            refunded_amount: alreadyRefunded + refundedRupees,
            razorpay_refund_id: refund.refundId,
            refund_status: "refunded",
          })
          .eq("id", id);
      } catch (err) {
        refundError = err instanceof Error ? err.message : "Unknown error";
        console.error("Refund failed during order cancellation — cancelling anyway", id, err);
        await supabase.from("orders").update({ refund_status: "failed" }).eq("id", id);
      }
    }

    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);

    const { data: items } = await supabase
      .from("order_items")
      .select("chapter_slug, quantity")
      .eq("order_id", id);
    for (const item of items ?? []) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("stock_on_hand")
        .eq("chapter_slug", item.chapter_slug)
        .maybeSingle();
      if (inv) {
        await supabase
          .from("inventory")
          .update({ stock_on_hand: inv.stock_on_hand + item.quantity })
          .eq("chapter_slug", item.chapter_slug);
      }
    }

    await supabase.from("order_events").insert({
      order_id: id,
      event_type: "cancelled",
      detail: refundError
        ? `refund failed: ${refundError}`
        : refundedRupees > 0
          ? `refunded ₹${refundedRupees}`
          : "no refund needed",
    });

    return NextResponse.json({ ok: true, refundedRupees, refundError });
  } catch (err) {
    console.error("Failed to cancel order", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not cancel order" },
      { status: 500 }
    );
  }
}
