import { getSupabaseServerClient } from "@/lib/supabase";
import { sendAbandonedCartWhatsApp, sendBuyNow10WhatsApp } from "@/lib/whatsapp-notify";
import { sendAbandonedCartEmail, sendBuyNow10Email } from "@/lib/email";

/** The coupon named in the stage-2 nudge — must exist as an active row in coupon_codes. */
export const BUYNOW10_COUPON_CODE = "BUYNOW10";

type CartSession = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  items: { name: string; quantity: number }[] | null;
  retargeted_at: string | null;
  second_nudge_sent_at?: string | null;
};

/** Sends the abandoned-cart nudge (WhatsApp + email) for exactly one session, and stamps retargeted_at on success. Shared by the sweep cron and the manual per-session admin action. */
export async function retargetOneSession(session: CartSession) {
  // WhatsApp-first: a phone number gets the nudge via WhatsApp only; email
  // is the fallback channel, used only when there's no phone (or WhatsApp
  // failed to send).
  const whatsappSent = session.customer_phone
    ? await sendAbandonedCartWhatsApp({
        id: session.id,
        customer_name: session.customer_name,
        customer_phone: session.customer_phone,
        items: session.items ?? [],
      })
    : false;
  const emailSent =
    !whatsappSent && session.customer_email
      ? await sendAbandonedCartEmail({
          customer_name: session.customer_name,
          customer_email: session.customer_email,
          items: session.items ?? [],
        })
      : false;

  if (whatsappSent || emailSent) {
    const now = new Date().toISOString();
    const supabase = getSupabaseServerClient();
    await supabase
      .from("cart_sessions")
      .update({
        retargeted_at: now,
        ...(whatsappSent ? { last_whatsapp_sent_at: now } : {}),
        ...(emailSent ? { last_email_sent_at: now } : {}),
      })
      .eq("id", session.id);
  }

  return { whatsappSent, emailSent };
}

/**
 * Stage 2 of the abandoned-cart sequence — fires 2 hours after the stage-1
 * plain reminder (retargetOneSession above), carrying the BUYNOW10 coupon
 * to actually push the sale. Same WhatsApp-first/email-fallback pattern,
 * stamps second_nudge_sent_at on success so it never repeats.
 */
export async function sendSecondNudgeForSession(session: CartSession) {
  const whatsappSent = session.customer_phone
    ? await sendBuyNow10WhatsApp(
        session.customer_phone,
        session.customer_name,
        (session.items ?? []).map((i) => `${i.quantity}x ${i.name}`).join(", ") || "your cart",
        BUYNOW10_COUPON_CODE,
        session.id
      )
    : false;
  const emailSent =
    !whatsappSent && session.customer_email
      ? await sendBuyNow10Email(
          {
            customer_name: session.customer_name,
            customer_email: session.customer_email,
            items: session.items ?? [],
          },
          BUYNOW10_COUPON_CODE,
          session.id
        )
      : false;

  if (whatsappSent || emailSent) {
    const now = new Date().toISOString();
    const supabase = getSupabaseServerClient();
    await supabase
      .from("cart_sessions")
      .update({
        second_nudge_sent_at: now,
        ...(whatsappSent ? { last_whatsapp_sent_at: now } : {}),
        ...(emailSent ? { last_email_sent_at: now } : {}),
      })
      .eq("id", session.id);
  }

  return { whatsappSent, emailSent };
}
