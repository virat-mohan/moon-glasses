import { getSupabaseServerClient } from "@/lib/supabase";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";
import { canReplyFreeForm } from "@/lib/whatsapp-window";
import { logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";

export const paidMessageText = (orderId: string) =>
  `*Payment Confirmed* ✓ ✨\n\nOrder #${orderId.slice(0, 8).toUpperCase()} is confirmed. We'll message you when it ships! 📦`;

/**
 * For orders that came from a WhatsApp cart: a short session message once payment
 * confirms, if the customer is still inside the 24h window. Deduped per order;
 * falls back silently (the normal confirmation template/email still go).
 */
export async function sendWaPaidMessage(order: { id: string; customer_phone: string; order_source?: string | null }) {
  try {
    if (order.order_source !== "whatsapp") return false;
    const supabase = getSupabaseServerClient();
    const digits = order.customer_phone.replace(/\D/g, "").slice(-10);
    const { data: conv } = await supabase.from("whatsapp_conversations").select("id").ilike("customer_phone", `%${digits}`).limit(1).maybeSingle();
    if (!conv) return false;
    const { data: msgs } = await supabase.from("whatsapp_conversation_messages").select("direction, created_at, body").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(60);
    const text = paidMessageText(order.id);
    if ((msgs ?? []).some((m) => m.direction === "outbound" && m.body === text)) return false;
    if (!canReplyFreeForm(msgs ?? [])) return false;
    const res = await sendWhatsAppSessionMessage(order.customer_phone, text);
    await logOutboundWhatsAppMessage({ conversationId: conv.id, body: text, providerMessageId: res.sent ? res.messageId : null, status: res.sent ? "sent" : "failed" });
    return res.sent;
  } catch (err) {
    console.error("WhatsApp paid message failed", err);
    return false;
  }
}
