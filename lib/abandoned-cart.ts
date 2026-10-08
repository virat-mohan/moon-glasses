import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { sendAbandonedCartWhatsApp, sendBuyNow10WhatsApp } from "@/lib/whatsapp-notify";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";
import { logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
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

export type UnpaidOrderForReminder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
};

/**
 * Sends a personalized WhatsApp payment link for an unpaid UPI QR order.
 * Deduped against whatsapp_messages (template_name: unpaid_order_reminder).
 */
export async function sendUnpaidOrderPaymentReminder(order: UnpaidOrderForReminder) {
  const phone = order.customer_phone;
  if (!phone) return false;

  const supabase = getSupabaseServerClient();
  const { data: items } = await supabase
    .from("order_items")
    .select("chapter_name, quantity")
    .eq("order_id", order.id);

  const orderNum = order.id.slice(0, 8).toUpperCase();
  const name = order.customer_name?.trim().split(/\s+/)[0] || "there";
  const payLink = `https://www.moon-glasses.store/pay/${order.id}`;
  const itemsText = items?.length
    ? items.map((i) => `${i.quantity}× ${i.chapter_name}`).join("\n")
    : null;

  const text = [
    `*Order Saved* 🕶️ ✨`,
    `Hey ${name}, we saved your order #${orderNum}.`,
    itemsText,
    `*Total: ₹${order.total.toLocaleString("en-IN")}* · Free Shipping 📦`,
    `📲 *Scan the QR here:*\n${payLink}`,
    "We'll pack and ship as soon as payment lands.",
  ].filter(Boolean).join("\n\n");

  const res = await sendWhatsAppSessionMessage(phone, text).catch(() => ({ sent: false as const }));
  const provider = (await getSetting("WHATSAPP_PROVIDER")) === "meta_cloud" ? "meta_cloud" : "msg91";

  try {
    await supabase.from("whatsapp_messages").insert({
      order_id: order.id,
      template_name: "unpaid_order_reminder",
      provider,
      msg91_message_id: res.sent && "messageId" in res ? res.messageId ?? null : null,
    });
  } catch (err) {
    console.error("Failed to log unpaid_order_reminder", err);
  }

  if (res.sent) {
    try {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("customer_phone", phone)
        .maybeSingle();

      if (conv) {
        await logOutboundWhatsAppMessage({
          conversationId: conv.id,
          body: text,
          providerMessageId: "messageId" in res ? res.messageId ?? null : null,
          status: "sent",
        });
      }
    } catch {}
  }

  return res.sent;
}

/**
 * Sweeps orders that are pending_upi_payment / unpaid between 10 minutes and 24 hours old.
 * Automatically sends the customer their direct payment link on WhatsApp.
 */
export async function retargetUnpaidUpiOrders(minutesIdle = 10, maxHoursOld = 24) {
  const supabase = getSupabaseServerClient();
  const minIdleTime = new Date(Date.now() - minutesIdle * 60 * 1000).toISOString();
  const maxAgeTime = new Date(Date.now() - maxHoursOld * 60 * 60 * 1000).toISOString();

  const { data: unpaidOrders, error } = await supabase
    .from("orders")
    .select("id, customer_name, customer_phone, total, created_at, status, payment_status")
    .eq("payment_type", "upi_qr")
    .eq("payment_status", "unpaid")
    .eq("status", "pending_upi_payment")
    .lt("created_at", minIdleTime)
    .gt("created_at", maxAgeTime);

  if (error || !unpaidOrders?.length) {
    return { eligible: 0, sent: 0 };
  }

  const orderIds = unpaidOrders.map((o) => o.id);
  const { data: alreadySentRows } = await supabase
    .from("whatsapp_messages")
    .select("order_id")
    .in("order_id", orderIds)
    .eq("template_name", "unpaid_order_reminder");

  const alreadySentSet = new Set((alreadySentRows ?? []).map((r) => r.order_id));
  const eligible = unpaidOrders.filter((o) => !alreadySentSet.has(o.id));

  let sent = 0;
  for (const order of eligible) {
    const ok = await sendUnpaidOrderPaymentReminder({
      id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      total: order.total,
    });
    if (ok) sent++;
  }

  return { eligible: eligible.length, sent };
}

