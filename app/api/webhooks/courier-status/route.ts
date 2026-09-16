import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendReturnRefundedEmail } from "@/lib/email";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { computeReturnRefundRupees, isValidReturnReason } from "@/lib/returns";
import { checkAndAlertLowStock } from "@/lib/inventory";
import { applyShipmentStatusUpdate } from "@/lib/shiprocket-status";

const DELIVERED_KEYWORDS = /delivered/i;

async function logOrderEvent(orderId: string, eventType: string, detail?: string) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("order_events").insert({ order_id: orderId, event_type: eventType, detail: detail ?? null });
  } catch (err) {
    console.error("Failed to log order_events row", orderId, eventType, err);
  }
}

/**
 * Shiprocket calls this on every shipment status change (Settings -> API ->
 * Webhooks in their dashboard), so the dashboard's shipment status updates
 * live instead of needing a manual "Refresh Tracking" click — and on the
 * transition into a failed-delivery (NDR) status, fires an automatic
 * WhatsApp nudge to the customer, since that's the actual window to save a
 * delivery before Shiprocket gives up and sends it back (RTO). On the
 * transition into delivered, fires the review-request email.
 *
 * Payload field names below follow Shiprocket's documented webhook shape,
 * but — like the Meta/MSG91 integrations earlier — this hasn't been
 * exercised against a real delivered webhook yet. Logs the raw body on
 * anything unrecognized so the first live event is easy to diagnose rather
 * than silently dropped. Always returns 200 quickly so Shiprocket doesn't
 * retry-storm on a downstream hiccup.
 */
export async function POST(request: Request) {
  const expectedToken = await getSetting("SHIPROCKET_WEBHOOK_TOKEN");
  const providedToken = request.headers.get("x-api-key");
  if (expectedToken && providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // Shiprocket echoes back whatever we sent as `order_id` when the shipment
  // was created — that's our own orders.id (see createShiprocketOrder in
  // lib/shiprocket.ts), so it's the most reliable match. Fall back to AWB
  // or their internal shipment id if the order_id field isn't present.
  const ourOrderId = body.order_id ?? body.channel_order_id ?? null;
  const awbCode = body.awb ?? body.awb_code ?? null;
  const shipmentId = body.shipment_id ? String(body.shipment_id) : null;
  const status = body.current_status ?? body.shipment_status ?? body.status ?? null;
  const courierName = body.courier_name ?? null;

  if (!status || (!ourOrderId && !awbCode && !shipmentId)) {
    console.error("Shiprocket webhook: unrecognized payload shape", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = getSupabaseServerClient();
    const newStatusEarly = String(status).toLowerCase();

    // A return-pickup shipment (customer-initiated return, see
    // /admin/returns) reports to this same webhook URL, but it's tracked by
    // return_requests.return_shipment_id, not orders.shiprocket_shipment_id
    // — check that first so it isn't mistaken for a forward shipment update.
    if (shipmentId || awbCode) {
      let returnLookup = supabase
        .from("return_requests")
        .select("id, order_id, reason, status, refunded_amount");
      returnLookup = shipmentId
        ? returnLookup.eq("return_shipment_id", shipmentId)
        : returnLookup.eq("return_shipment_id", awbCode);
      const { data: returnRequest } = await returnLookup.maybeSingle();

      if (returnRequest) {
        // Only the transition into "delivered" (back at the pickup
        // location) triggers anything — same reasoning as RTO: refund
        // before physical confirmation risks refunding an item that's lost
        // or still in transit.
        if (DELIVERED_KEYWORDS.test(newStatusEarly) && returnRequest.status !== "refunded") {
          const { data: order } = await supabase
            .from("orders")
            .select("id, customer_name, customer_phone, customer_email, total, shipping_charge, refunded_amount, razorpay_payment_id")
            .eq("id", returnRequest.order_id)
            .maybeSingle();

          if (order && isValidReturnReason(returnRequest.reason)) {
            const refundRupees = computeReturnRefundRupees(
              returnRequest.reason,
              order,
              (order.refunded_amount ?? 0) + (returnRequest.refunded_amount ?? 0)
            );
            let refundedRupees = 0;

            if (refundRupees > 0 && order.razorpay_payment_id) {
              try {
                const refund = await refundRazorpayPayment(order.razorpay_payment_id, refundRupees);
                refundedRupees = refund.amountRupees;
                await supabase
                  .from("orders")
                  .update({
                    refunded_amount: (order.refunded_amount ?? 0) + refundedRupees,
                    razorpay_refund_id: refund.refundId,
                    refund_status: "refunded",
                  })
                  .eq("id", order.id);
              } catch (err) {
                console.error("Return auto-refund failed", returnRequest.id, err);
                await logOrderEvent(order.id, "return_refund_failed", err instanceof Error ? err.message : String(err));
              }
            }

            const { data: items } = await supabase
              .from("order_items")
              .select("chapter_slug, quantity")
              .eq("order_id", order.id);
            for (const item of items ?? []) {
              const { data: inv } = await supabase
                .from("inventory")
                .select("stock_on_hand")
                .eq("chapter_slug", item.chapter_slug)
                .maybeSingle();
              if (inv) {
                const newStock = inv.stock_on_hand + item.quantity;
                await supabase.from("inventory").update({ stock_on_hand: newStock }).eq("chapter_slug", item.chapter_slug);
                await checkAndAlertLowStock(item.chapter_slug, newStock);
              }
            }

            await supabase
              .from("return_requests")
              .update({
                status: "refunded",
                refunded_amount: refundedRupees,
                updated_at: new Date().toISOString(),
              })
              .eq("id", returnRequest.id);
            await logOrderEvent(
              order.id,
              "return_refunded",
              `${returnRequest.reason} — ₹${refundedRupees}, restocked ${(items ?? []).map((i) => i.chapter_slug).join(", ")}`
            );

            if (refundedRupees > 0 && order.customer_email) {
              await sendReturnRefundedEmail(order.customer_email, order.customer_name, order.id, refundedRupees);
            }
          }
        }
        // Matched a return shipment either way (delivered or not) — never
        // fall through to the forward-order logic below for this webhook hit.
        return NextResponse.json({ ok: true });
      }
    }

    await applyShipmentStatusUpdate({
      orderId: ourOrderId,
      shipmentId,
      awbCode,
      status,
      courierName,
    });
  } catch (err) {
    console.error("Shiprocket webhook handling failed", err);
  }

  return NextResponse.json({ ok: true });
}
