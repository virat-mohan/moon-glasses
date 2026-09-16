import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMetaConversionEvent } from "@/lib/meta-conversions";

/**
 * Called from every order-creation path (WhatsApp flow and Razorpay) right
 * after an order is saved. Closes the loop on the abandoned-cart system:
 * flips the matching cart_session to 'converted' (so the abandon-sweep never
 * retargets someone who already bought), links any WhatsApp retarget
 * message sent for that session to this order for conversion reporting, and
 * mirrors the Purchase event to Meta server-side. Best-effort throughout —
 * none of this can fail the order itself.
 */
export async function markCartSessionConverted(
  sessionKey: string | undefined,
  order: { id: string; customer_email: string; customer_phone: string; total: number }
) {
  if (!sessionKey) {
    await sendMetaConversionEvent("Purchase", {
      email: order.customer_email,
      phone: order.customer_phone,
      value: order.total,
    });
    return;
  }

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

  await sendMetaConversionEvent("Purchase", {
    email: order.customer_email,
    phone: order.customer_phone,
    value: order.total,
  });
}
