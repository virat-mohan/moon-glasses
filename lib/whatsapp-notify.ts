import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMsg91WhatsAppFlow, sendMsg91Template } from "@/lib/msg91";
import { sendMetaCloudTemplate } from "@/lib/whatsapp-cloud";
import { generateAndUploadOrderCard } from "@/lib/order-card";

type OrderForWhatsApp = { id: string; customer_name: string; customer_phone: string; total: number };
type OrderItemForCard = { chapter_name: string; quantity: number };
type CartSessionForWhatsApp = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: { name: string; quantity: number }[];
};

async function logSend(
  messageId: string | null | undefined,
  templateName: string,
  logAgainst: { cartSessionId?: string; orderId?: string },
  provider: "msg91" | "meta_cloud" = "msg91"
) {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("whatsapp_messages").insert({
      cart_session_id: logAgainst.cartSessionId ?? null,
      order_id: logAgainst.orderId ?? null,
      provider,
      msg91_message_id: messageId ?? null,
      template_name: templateName,
    });
  } catch (err) {
    console.error("Failed to log whatsapp_messages row", err);
  }
}

async function sendTemplate(
  phone: string,
  templateName: string,
  msg91TemplateId: string | null,
  variables: string[],
  logAgainst: { cartSessionId?: string; orderId?: string },
  mediaUrl?: string
) {
  const result = await sendMsg91WhatsAppFlow(msg91TemplateId, phone, variables, mediaUrl);
  if (result.sent) {
    await logSend(result.messageId, templateName, logAgainst);
    return true;
  }
  return false;
}

/**
 * Same as sendTemplate above, but addresses the template by its actual
 * approved name rather than an MSG91 Flow slug — the shape every provider
 * that isn't MSG91's older Flow product uses. Prefer this for any new
 * template going forward.
 *
 * Routes to whichever provider WHATSAPP_PROVIDER names — "meta_cloud" for
 * a direct Meta WhatsApp Cloud API send (lib/whatsapp-cloud.ts), anything
 * else (including unset) defaults to MSG91 (lib/msg91.ts), the original
 * integration. The `templateName`/settings VALUE passed in as
 * `providerTemplateName` must be that provider's own approved template
 * name — swapping providers means re-pointing that setting at the
 * equivalent template approved under the new provider, not a code change.
 */
async function sendTemplateByName(
  phone: string,
  templateName: string,
  providerTemplateName: string | null,
  variables: string[],
  logAgainst: { cartSessionId?: string; orderId?: string },
  header?: { type: "image" | "document"; url: string; filename?: string }
) {
  if (!providerTemplateName) return false;
  const provider = (await getSetting("WHATSAPP_PROVIDER")) === "meta_cloud" ? "meta_cloud" : "msg91";
  const result =
    provider === "meta_cloud"
      ? await sendMetaCloudTemplate(providerTemplateName, phone, variables, header)
      : await sendMsg91Template(providerTemplateName, phone, variables, header);
  if (result.sent) {
    await logSend(result.messageId, templateName, logAgainst, provider);
    return true;
  }
  return false;
}

/**
 * Sends an order-confirmation WhatsApp message via MSG91's bulk API, with a
 * branded "Order Confirmed" card (generated via @vercel/og) as the
 * template's image header — WhatsApp doesn't render HTML, so an image +
 * formatted text is the closest equivalent to a designed email. Needs an
 * approved template (image header, three body variables in order: customer
 * name, order number, total) named exactly as set in
 * MSG91_ORDER_CONFIRMATION_TEMPLATE_ID in /admin/settings.
 */
export async function sendOrderConfirmationWhatsApp(order: OrderForWhatsApp, items: OrderItemForCard[] = []) {
  const msg91TemplateName = await getSetting("MSG91_ORDER_CONFIRMATION_TEMPLATE_ID");
  const variables = [
    order.customer_name,
    order.id.slice(0, 8).toUpperCase(),
    `₹${order.total.toLocaleString("en-IN")}`,
  ];

  let cardUrl: string | undefined;
  try {
    cardUrl = await generateAndUploadOrderCard(order, items);
  } catch (err) {
    console.error("Failed to generate order confirmation card — sending without it", err);
  }

  return sendTemplateByName(
    order.customer_phone,
    "order_confirmation",
    msg91TemplateName,
    variables,
    { orderId: order.id },
    cardUrl ? { type: "image", url: cardUrl } : undefined
  );
}

/**
 * Internal "ready to ship" WhatsApp notification — sent to the warehouse
 * team's own numbers (WAREHOUSE_WHATSAPP_NUMBERS, comma-separated) right
 * alongside the warehouse email, with the same duplicated (2-copy) label
 * sheet as the template's document header. The approved "shipnotification"
 * template only has 4 body variables — order number, customer name,
 * customer phone, items — so the total amount is folded into the items
 * string rather than getting its own slot. Courier name isn't in the body
 * at all (it's already on the label itself). Set the approved name as
 * MSG91_SHIP_NOTIFICATION_TEMPLATE_ID in /admin/settings.
 */
export async function sendShipNotificationWhatsApp(
  orderId: string,
  customerName: string,
  customerPhone: string,
  itemsLine: string,
  totalRupees: number,
  labelUrl: string
) {
  const msg91TemplateName = await getSetting("MSG91_SHIP_NOTIFICATION_TEMPLATE_ID");
  const numbers = (await getSetting("WAREHOUSE_WHATSAPP_NUMBERS"))
    ?.split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  if (!numbers || numbers.length === 0) return false;

  const variables = [
    orderId.slice(0, 8).toUpperCase(),
    customerName,
    customerPhone,
    `${itemsLine} — Total ₹${totalRupees.toLocaleString("en-IN")}`,
  ];
  const orderNumber = orderId.slice(0, 8).toUpperCase();
  const results = await Promise.all(
    numbers.map((phone) =>
      sendTemplateByName(phone, "ship_notification", msg91TemplateName, variables, { orderId }, {
        type: "document",
        url: labelUrl,
        filename: `label-${orderNumber}.pdf`,
      })
    )
  );
  return results.some(Boolean);
}

/**
 * Win-back nudge for the imported past-customer list (pre-migration-platform
 * orders, see legacy_customers) — distinct from sendWinbackWhatsApp, which
 * targets lapsed *current-site* accounts with a Miles reminder. This one
 * targets people who bought before the current site existed, so it leads
 * with a coupon instead. Uses the approved bulk-API template, two body
 * variables in order: name, coupon code — the link is a static URL button
 * on the template itself, not a body variable, so it needs no runtime
 * value here. Set the template's name as MSG91_LEGACY_WINBACK_TEMPLATE_ID
 * in /admin/settings.
 */
export async function sendLegacyWinbackWhatsApp(phone: string, name: string | null, couponCode: string) {
  const msg91TemplateName = await getSetting("MSG91_LEGACY_WINBACK_TEMPLATE_ID");
  const variables = [name ?? "there", couponCode];
  return sendTemplateByName(phone, "legacy_winback", msg91TemplateName, variables, {});
}

/**
 * Sends an abandoned-cart nudge via MSG91. MSG91_ABANDONED_CART_TEMPLATE_ID
 * holds the approved template's actual name (e.g. "abandoned_cart_nudge"),
 * not a Flow slug — set in /admin/settings. Called from the abandon-sweep
 * cron/route, never more than once per session (caller checks retargeted_at
 * first).
 */
export async function sendAbandonedCartWhatsApp(session: CartSessionForWhatsApp) {
  if (!session.customer_phone) return false;
  const itemSummary = session.items.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "your cart";
  const msg91TemplateName = await getSetting("MSG91_ABANDONED_CART_TEMPLATE_ID");
  const variables = [session.customer_name ?? "there", itemSummary];
  return sendTemplateByName(session.customer_phone, "abandoned_cart", msg91TemplateName, variables, {
    cartSessionId: session.id,
  });
}

/**
 * Sends a restock alert via MSG91 — template takes three variables: customer
 * name, chapter name, chapter URL. Set MSG91_RESTOCK_TEMPLATE_ID in
 * /admin/settings to the approved template's name.
 */
export async function sendRestockWhatsApp(phone: string, name: string | null, chapterName: string, chapterUrl: string) {
  const msg91TemplateName = await getSetting("MSG91_RESTOCK_TEMPLATE_ID");
  const variables = [name ?? "there", chapterName, chapterUrl];
  return sendTemplateByName(phone, "restock_alert", msg91TemplateName, variables, {});
}

/**
 * Second-stage abandoned-cart nudge, 2 hours after the first plain reminder
 * — this one carries a discount code to actually push the sale over the
 * line. Template takes three variables: customer name, item summary,
 * coupon code. Set MSG91_BUYNOW10_TEMPLATE_ID in /admin/settings to the
 * approved template's name.
 */
export async function sendBuyNow10WhatsApp(
  phone: string,
  name: string | null,
  itemsLine: string,
  couponCode: string,
  cartSessionId: string
) {
  const msg91TemplateName = await getSetting("MSG91_BUYNOW10_TEMPLATE_ID");
  const variables = [name ?? "there", itemsLine, couponCode];
  return sendTemplateByName(phone, "buynow10_nudge", msg91TemplateName, variables, { cartSessionId });
}

/**
 * Sends a post-delivery review-request nudge via MSG91 — template takes
 * three variables: customer name, item summary, and (by design, always the
 * same constant) the Google review link. Set MSG91_REVIEW_REQUEST_TEMPLATE_ID
 * in /admin/settings to the approved template's name.
 */
export async function sendReviewRequestWhatsApp(phone: string, name: string | null, itemsLine: string) {
  const msg91TemplateName = await getSetting("MSG91_REVIEW_REQUEST_TEMPLATE_ID");
  const variables = [name ?? "there", itemsLine, "https://g.page/r/CbvWdBDo1oxlEBM/review"];
  return sendTemplateByName(phone, "review_request", msg91TemplateName, variables, {});
}

/**
 * Sends a nudge after a failed delivery attempt (NDR) — this is the actual
 * RTO-prevention intervention, since it lands in the window before Shiprocket
 * gives up and sends the shipment back. Needs a Flow with two variables:
 * customer name, order number — set its ID as MSG91_NDR_TEMPLATE_ID in
 * /admin/settings. Called from the Shiprocket webhook on the state
 * transition into an NDR status, not on every webhook hit while already in
 * that status, so a retried webhook can't spam the customer repeatedly.
 */
export async function sendNdrWhatsApp(order: OrderForWhatsApp) {
  const msg91TemplateId = await getSetting("MSG91_NDR_TEMPLATE_ID");
  const variables = [order.customer_name, order.id.slice(0, 8).toUpperCase()];
  return sendTemplate(order.customer_phone, "ndr_nudge", msg91TemplateId, variables, {
    orderId: order.id,
  });
}

/**
 * Sends a heads-up when a shipment enters an RTO-in-transit status — before
 * the refund, since the item hasn't physically come back yet at this point.
 * Needs a Flow with two variables: customer name, order number — set its ID
 * as MSG91_RTO_INITIATED_TEMPLATE_ID in /admin/settings.
 */
export async function sendRtoInitiatedWhatsApp(order: OrderForWhatsApp) {
  const msg91TemplateId = await getSetting("MSG91_RTO_INITIATED_TEMPLATE_ID");
  const variables = [order.customer_name, order.id.slice(0, 8).toUpperCase()];
  return sendTemplate(order.customer_phone, "rto_initiated", msg91TemplateId, variables, {
    orderId: order.id,
  });
}

/**
 * Sends confirmation once the RTO'd item is physically back and the refund
 * has actually gone through. Needs a Flow with three variables: customer
 * name, order number, refund amount — set its ID as
 * MSG91_RTO_REFUNDED_TEMPLATE_ID in /admin/settings.
 */
export async function sendRtoRefundedWhatsApp(order: OrderForWhatsApp, refundRupees: number) {
  const msg91TemplateId = await getSetting("MSG91_RTO_REFUNDED_TEMPLATE_ID");
  const variables = [order.customer_name, order.id.slice(0, 8).toUpperCase(), `₹${refundRupees.toLocaleString("en-IN")}`];
  return sendTemplate(order.customer_phone, "rto_refunded", msg91TemplateId, variables, {
    orderId: order.id,
  });
}

/**
 * Sends a referral invite by WhatsApp — best-effort alongside the email,
 * which always sends regardless since it needs no template approval. Uses
 * the approved "referralinvite" bulk-API template, three body variables in
 * order: friend name, referrer name, referral link — set its name as
 * MSG91_REFERRAL_INVITE_TEMPLATE_ID in /admin/settings.
 */
export async function sendReferralInviteWhatsApp(
  friendPhone: string,
  friendName: string,
  referrerName: string,
  referralUrl: string
) {
  const msg91TemplateName = await getSetting("MSG91_REFERRAL_INVITE_TEMPLATE_ID");
  const variables = [friendName, referrerName, referralUrl];
  return sendTemplateByName(friendPhone, "referral_invite", msg91TemplateName, variables, {});
}

/**
 * Retention nudge by WhatsApp — best-effort alongside the email, which
 * always sends regardless. Uses the approved "winback" bulk-API template,
 * two body variables in order: name, miles balance.
 */
export async function sendWinbackWhatsApp(phone: string, name: string, milesBalance: number) {
  const msg91TemplateName = await getSetting("MSG91_WINBACK_TEMPLATE_ID");
  const variables = [name, String(milesBalance)];
  return sendTemplateByName(phone, "winback", msg91TemplateName, variables, {});
}
