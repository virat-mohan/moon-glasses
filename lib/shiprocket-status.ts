import { getSupabaseServerClient } from "@/lib/supabase";
import { sendNdrWhatsApp, sendRtoInitiatedWhatsApp, sendRtoRefundedWhatsApp, sendReviewRequestWhatsApp } from "@/lib/whatsapp-notify";
import { sendReviewRequestEmail, sendRtoInitiatedEmail, sendRtoRefundedEmail } from "@/lib/email";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { checkAndAlertLowStock } from "@/lib/inventory";

// Broad keyword match rather than an exact status list — Shiprocket's status
// strings vary by courier partner, and catching a superset (with occasional
// false positives) is a much smaller cost than silently missing a real NDR
// and losing the one window to save the delivery before RTO.
const NDR_KEYWORDS = /ndr|undeliver|delivery fail|delivery attempt|not available|consignee/i;
const DELIVERED_KEYWORDS = /delivered/i;
const RTO_KEYWORDS = /rto|return to origin|returned to origin/i;

async function logOrderEvent(orderId: string, eventType: string, detail?: string) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("order_events").insert({ order_id: orderId, event_type: eventType, detail: detail ?? null });
  } catch (err) {
    console.error("Failed to log order_events row", orderId, eventType, err);
  }
}

/**
 * The single place a forward-shipment status update (NDR nudge, RTO
 * refund/restock, delivered review-request) actually gets applied — shared
 * by the live Shiprocket webhook (app/api/webhooks/courier-status) and the
 * polling cron (app/api/cron/track-sweep) so staleness-recovery via polling
 * can never drift from what the webhook does. Every write here is guarded
 * by a transition check (`was X` vs `is X`) so calling this twice with the
 * same status, from either caller, is always a safe no-op.
 */
export async function applyShipmentStatusUpdate(input: {
  orderId?: string | null;
  shipmentId?: string | null;
  awbCode?: string | null;
  status: string;
  courierName?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  const { orderId, shipmentId, awbCode, status, courierName } = input;

  let lookup = supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, customer_email, shipment_status, review_requested_at, total, shipping_charge, refunded_amount, razorpay_payment_id, rto_notified_at, rto_processed_at, delivered_at"
    );
  if (orderId) lookup = lookup.eq("id", orderId);
  else if (shipmentId) lookup = lookup.eq("shiprocket_shipment_id", shipmentId);
  else if (awbCode) lookup = lookup.eq("shiprocket_awb_code", awbCode);
  else return;
  const { data: existing } = await lookup.maybeSingle();
  if (!existing) return;

  const newStatus = String(status).toLowerCase();
  const oldStatus = existing.shipment_status ?? "";

  // RTO must be checked first and excluded from the other two — "RTO
  // Delivered" contains "delivered" as a substring (would otherwise fire
  // the review-request email), and Shiprocket's RTO statuses don't overlap
  // NDR's keywords in practice, but checking order here still matters.
  const wasRto = RTO_KEYWORDS.test(oldStatus);
  const isRto = RTO_KEYWORDS.test(newStatus);
  // "RTO Initiated" / "RTO In Transit" vs the shipment actually being back —
  // refund/restock must only fire on the latter, not the moment RTO starts.
  const wasRtoDelivered = wasRto && DELIVERED_KEYWORDS.test(oldStatus);
  const isRtoDelivered = isRto && DELIVERED_KEYWORDS.test(newStatus);

  const wasNdr = !wasRto && NDR_KEYWORDS.test(oldStatus);
  const isNdr = !isRto && NDR_KEYWORDS.test(newStatus);
  // "undelivered" contains "delivered" as a substring — NDR must win that check.
  const wasDelivered = !wasRto && !wasNdr && DELIVERED_KEYWORDS.test(oldStatus);
  const isDelivered = !isRto && !isNdr && DELIVERED_KEYWORDS.test(newStatus);

  const patch: Record<string, string> = { shipment_status: newStatus };
  if (awbCode) patch.shiprocket_awb_code = awbCode;
  if (courierName) patch.courier_name = courierName;
  await supabase.from("orders").update(patch).eq("id", existing.id);

  // Only on the transition into NDR, not on every hit while already in that
  // status — a retried/duplicate signal for the same failed attempt must
  // never spam the customer repeatedly.
  if (isNdr && !wasNdr && existing.customer_phone) {
    await sendNdrWhatsApp({
      id: existing.id,
      customer_name: existing.customer_name,
      customer_phone: existing.customer_phone,
      total: 0,
    });
  }

  // RTO in transit — heads-up only, nothing financial yet since the item
  // hasn't physically come back. rto_notified_at is the transition guard
  // (mirrors review_requested_at's role for delivered).
  if (isRto && !isRtoDelivered && !wasRto && !existing.rto_notified_at) {
    // WhatsApp-first: a phone number gets this via WhatsApp only; email is
    // the fallback, used only when there's no phone (or WhatsApp failed).
    const rtoInitiatedWhatsAppSent = existing.customer_phone
      ? await sendRtoInitiatedWhatsApp({
          id: existing.id,
          customer_name: existing.customer_name,
          customer_phone: existing.customer_phone,
          total: 0,
        })
      : false;
    if (!rtoInitiatedWhatsAppSent && existing.customer_email) {
      await sendRtoInitiatedEmail(existing.customer_email, existing.customer_name, existing.id);
    }
    await supabase.from("orders").update({ rto_notified_at: new Date().toISOString() }).eq("id", existing.id);
    await logOrderEvent(existing.id, "rto_initiated", newStatus);
  }

  // RTO actually delivered back — the one moment refund + restock fire,
  // guarded by rto_processed_at so a retried signal can't double-refund or
  // double-restock. Shipping stays non-refundable (standard D2C policy);
  // refund failure (e.g. insufficient Razorpay balance) is logged but must
  // never block the restock, since the physical item being back is
  // independent of whether Razorpay could move money right now.
  if (isRtoDelivered && !wasRtoDelivered && !existing.rto_processed_at) {
    const refundRupees = Math.max(0, existing.total - (existing.shipping_charge ?? 0) - (existing.refunded_amount ?? 0));
    let refundedRupees = 0;

    if (refundRupees > 0 && existing.razorpay_payment_id) {
      try {
        const refund = await refundRazorpayPayment(existing.razorpay_payment_id, refundRupees);
        refundedRupees = refund.amountRupees;
        await supabase
          .from("orders")
          .update({
            refunded_amount: (existing.refunded_amount ?? 0) + refundedRupees,
            razorpay_refund_id: refund.refundId,
            refund_status: "refunded",
          })
          .eq("id", existing.id);
        await logOrderEvent(existing.id, "rto_refunded", `₹${refundedRupees} via ${refund.refundId}`);
      } catch (err) {
        console.error("RTO auto-refund failed", existing.id, err);
        await logOrderEvent(existing.id, "rto_refund_failed", err instanceof Error ? err.message : String(err));
      }
    }

    const { data: items } = await supabase.from("order_items").select("chapter_slug, quantity").eq("order_id", existing.id);
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
    await logOrderEvent(existing.id, "rto_restocked", (items ?? []).map((i) => i.chapter_slug).join(", "));

    await supabase.from("orders").update({ rto_processed_at: new Date().toISOString() }).eq("id", existing.id);

    if (refundedRupees > 0) {
      // WhatsApp-first: a phone number gets this via WhatsApp only; email is
      // the fallback, used only when there's no phone (or WhatsApp failed).
      const rtoRefundedWhatsAppSent = existing.customer_phone
        ? await sendRtoRefundedWhatsApp(
            { id: existing.id, customer_name: existing.customer_name, customer_phone: existing.customer_phone, total: 0 },
            refundedRupees
          )
        : false;
      if (!rtoRefundedWhatsAppSent && existing.customer_email) {
        await sendRtoRefundedEmail(existing.customer_email, existing.customer_name, existing.id, refundedRupees);
      }
    }
  }

  // delivered_at is the anchor the return window (Flow 3) counts from — set
  // once, on the real transition, never overwritten by a later
  // duplicate/retried "delivered" hit.
  if (isDelivered && !wasDelivered && !existing.delivered_at) {
    await supabase.from("orders").update({ delivered_at: new Date().toISOString() }).eq("id", existing.id);
  }

  // Same transition-only guard, plus review_requested_at as a second safety
  // net in case a delivered->something->delivered flip ever happens on a
  // courier's side — never send the review ask twice.
  if (isDelivered && !wasDelivered && !existing.review_requested_at && (existing.customer_phone || existing.customer_email)) {
    const { data: items } = await supabase.from("order_items").select("chapter_name").eq("order_id", existing.id);
    const chapterNames = [...new Set((items ?? []).map((i) => i.chapter_name))];
    if (chapterNames.length > 0) {
      const itemsLine = chapterNames.join(", ");
      // WhatsApp-first: a phone number gets this via WhatsApp only; email is
      // the fallback, used only when there's no phone (or WhatsApp failed).
      const whatsappSent = existing.customer_phone
        ? await sendReviewRequestWhatsApp(existing.customer_phone, existing.customer_name, itemsLine)
        : false;
      const emailSent =
        !whatsappSent && existing.customer_email
          ? await sendReviewRequestEmail(existing.customer_email, existing.customer_name, existing.id, chapterNames)
          : false;
      if (whatsappSent || emailSent) {
        await supabase.from("orders").update({ review_requested_at: new Date().toISOString() }).eq("id", existing.id);
      }
    }
  }
}
