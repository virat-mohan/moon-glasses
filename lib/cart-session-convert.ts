import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMetaConversionEvent } from "@/lib/meta-conversions";
import { purchaseEventId } from "@/lib/checkout-rules";

type ConvertedOrder = { id: string; customer_email: string; customer_phone: string; total: number };

/**
 * The one server-side Meta Purchase sender. event_id is the order id — the
 * same id the browser pixel sends as eventID — so Meta counts the Purchase
 * once. Call it only when the order is actually paid.
 */
export async function sendPurchaseConversion(order: ConvertedOrder) {
  await sendMetaConversionEvent("Purchase", {
    email: order.customer_email,
    phone: order.customer_phone,
    value: order.total,
    eventId: purchaseEventId(order.id),
  });
}

/**
 * Called from every order-creation path right after an order is saved.
 * Closes the loop on the abandoned-cart system: flips the matching
 * cart_session to 'converted' (so the abandon-sweep never retargets someone
 * who already ordered) and links any WhatsApp retarget message sent for that
 * session to this order for conversion reporting. When the order is already
 * paid it also mirrors the Purchase to Meta; an unpaid UPI order passes
 * { sendPurchase: false } and confirmUpiOrderPayment sends it on payment.
 * Best-effort throughout — none of this can fail the order itself.
 */
export async function markCartSessionConverted(
  sessionKey: string | undefined,
  order: ConvertedOrder,
  options: { sendPurchase?: boolean } = {}
) {
  const sendPurchase = options.sendPurchase ?? true;

  if (sessionKey) {
    try {
      const supabase = getSupabaseServerClient();
      const { data: session } = await supabase
        .from("cart_sessions")
        .update({ status: "converted" })
        .eq("session_key", sessionKey)
        .select()
        .maybeSingle();

      if (session) {
        await supabase
          .from("whatsapp_messages")
          .update({ converted: true, order_id: order.id })
          .eq("cart_session_id", session.id);
      }
    } catch (err) {
      console.error("Failed to mark cart session converted", err);
    }
  }

  if (sendPurchase) await sendPurchaseConversion(order);
}
