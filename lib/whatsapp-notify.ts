import { getBrandProfile } from "@/lib/brand";
import { getSetting } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendMsg91Template } from "@/lib/msg91";
import { sendMetaCloudTemplate } from "@/lib/whatsapp-cloud";
import { generateAndUploadPwapShareCard } from "@/lib/pwap-share-card";
import { voiceGate } from "@/lib/brand-voice";
import {
  alreadyAlerted,
  buildOrderAlertParams,
  normalizeAlertNumber,
  orderAlertLogName,
  type OrderAlertEvent,
  type OrderAlertOrder,
} from "@/lib/order-alert";

type OrderForWhatsApp = { id: string; customer_name: string; customer_phone: string; total: number };
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
  header?: { type: "image" | "document"; url: string; filename?: string },
  opts: { internal?: boolean } = {}
) {
  if (!providerTemplateName) return false;
  // Brand book lock: the template body is fixed by Meta, so only the rendered
  // variables are checked. A "block" stops the send (reported as not sent).
  const gate = voiceGate(variables.join("\n"), "whatsapp", `WhatsApp template ${templateName}`, opts);
  if (!gate.ok) return false;
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
 * Order confirmation. Template body variables in order: customer name,
 * order number, total. Name set as MSG91_ORDER_CONFIRMATION_TEMPLATE_ID.
 */
export async function sendOrderConfirmationWhatsApp(order: OrderForWhatsApp) {
  const msg91TemplateName = await getSetting("MSG91_ORDER_CONFIRMATION_TEMPLATE_ID");
  const variables = [
    order.customer_name,
    order.id.slice(0, 8).toUpperCase(),
    `₹${order.total.toLocaleString("en-IN")}`,
  ];

  return sendTemplateByName(order.customer_phone, "order_confirmation", msg91TemplateName, variables, { orderId: order.id });
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
    labelUrl,
  ];
  const results = await Promise.all(
    numbers.map((phone) =>
      // Internal: warehouse team, items line carries supplier model names on purpose.
      sendTemplateByName(phone, "ship_notification", msg91TemplateName, variables, { orderId }, undefined, { internal: true })
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
 * three variables: customer name, item summary, and our own /review/<orderId> page link. Set MSG91_REVIEW_REQUEST_TEMPLATE_ID
 * in /admin/settings to the approved template's name.
 */
export async function sendReviewRequestWhatsApp(phone: string, name: string | null, itemsLine: string, orderId: string) {
  const msg91TemplateName = await getSetting("MSG91_REVIEW_REQUEST_TEMPLATE_ID");
  // Our own review page first; it offers Google to everyone afterwards.
  const brand = await getBrandProfile();
  const variables = [name ?? "there", itemsLine, `${brand.siteUrl.replace(/\/$/, "")}/review/${orderId}`];
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
  return sendTemplateByName(order.customer_phone, "ndr_nudge", msg91TemplateId, variables, {
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
  return sendTemplateByName(order.customer_phone, "rto_initiated", msg91TemplateId, variables, {
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
  return sendTemplateByName(order.customer_phone, "rto_refunded", msg91TemplateId, variables, {
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

/**
 * Pay With A Post confirmation: the shopper's code and how many friends need
 * to buy with it. Once the image version (MSG91_PWAP_SHARE_TEMPLATE_ID, same
 * body, image header) is approved, it carries a ready-to-post card they can
 * forward straight to Instagram; until then the text version goes out.
 */
export async function sendPostBarterConfirmedWhatsApp(
  order: OrderForWhatsApp,
  couponCode: string,
  requiredOrders: number,
  itemName: string
) {
  const variables = [order.customer_name, couponCode, String(requiredOrders), itemName];
  let cardUrl: string | null = null;
  try {
    cardUrl = await generateAndUploadPwapShareCard(order.id, couponCode);
  } catch (err) {
    console.error("Pay With A Post share card failed", order.id, err);
  }

  // Preferred: the UTILITY order-link template (code, posting steps, link to
  // the order page with the share image). Utility messages always deliver;
  // pwap_share_post was re-classed MARKETING by Meta and WhatsApp can hold
  // those back silently, so the image message is a best-effort extra below.
  const linkTemplate = await getSetting("MSG91_PWAP_ORDER_LINK_TEMPLATE_ID");
  let confirmed = false;
  if (linkTemplate) {
    confirmed = await sendTemplateByName(
      order.customer_phone,
      "pwap_order_link",
      linkTemplate,
      [order.customer_name, couponCode, String(requiredOrders), order.id],
      { orderId: order.id }
    );
  }

  // Otherwise the approved text confirmation (UTILITY). Then the image as a best-effort extra.
  if (!confirmed) {
    confirmed = await sendTemplateByName(
      order.customer_phone,
      "pwap_order_confirmed",
      await getSetting("MSG91_PWAP_CONFIRMED_TEMPLATE_ID"),
      variables,
      { orderId: order.id }
    );
  }
  const shareTemplate = await getSetting("MSG91_PWAP_SHARE_TEMPLATE_ID");
  if (shareTemplate && cardUrl) {
    await sendTemplateByName(order.customer_phone, "pwap_share_post", shareTemplate, variables, { orderId: order.id }, {
      type: "image",
      url: cardUrl,
    }).catch(() => false);
  }
  return confirmed;
}

/** Sent each time a friend's paid order lands on a Pay With A Post code, before the threshold is reached. */
export async function sendPostBarterProgressWhatsApp(
  orderId: string,
  phone: string,
  name: string,
  soFar: number,
  required: number,
  couponCode: string
) {
  // UTILITY order-status version first (delivers); Meta re-classed the
  // original pwap_progress as MARKETING, which WhatsApp can hold back.
  const status = await sendTemplateByName(
    phone,
    "pwap_order_status",
    await getSetting("MSG91_PWAP_STATUS_TEMPLATE_ID"),
    [name, String(soFar), String(required), couponCode, orderId],
    { orderId }
  );
  if (status) return true;
  const templateName = await getSetting("MSG91_PWAP_PROGRESS_TEMPLATE_ID");
  return sendTemplateByName(
    phone,
    "pwap_progress",
    templateName,
    [name, String(soFar), String(required), couponCode, String(Math.max(0, required - soFar))],
    { orderId }
  );
}

/** Sent when a Pay With A Post order hits its threshold and ships free. */
export async function sendPostBarterShippedWhatsApp(orderId: string, phone: string, name: string, itemName: string) {
  // UTILITY dispatch notice first; pwap_shipped was re-classed MARKETING.
  const dispatched = await sendTemplateByName(
    phone,
    "pwap_order_dispatched",
    await getSetting("MSG91_PWAP_DISPATCHED_TEMPLATE_ID"),
    [name, itemName, orderId],
    { orderId }
  );
  if (dispatched) return true;
  const templateName = await getSetting("MSG91_PWAP_SHIPPED_TEMPLATE_ID");
  return sendTemplateByName(phone, "pwap_shipped", templateName, [name, itemName], { orderId });
}

/** A further free pair earned on a Pay With A Post code (every 3 more sales). */
export async function sendPwapFreePairWhatsApp(orderId: string, phone: string, name: string, freeCode: string) {
  const templateName = await getSetting("MSG91_PWAP_FREE_PAIR_TEMPLATE_ID");
  return sendTemplateByName(phone, "pwap_free_pair", templateName, [name, freeCode], { orderId });
}

/**
 * Internal order alert to the team's number (ORDER_ALERT_WHATSAPP, default
 * 919999277240) via the UTILITY template new_order_alert. Fires on order
 * creation and again when a UPI payment is confirmed. Deduped per order +
 * event against whatsapp_messages (template_name order_alert_created /
 * order_alert_paid), so retries and double confirms send once. Skips
 * silently until the template is approved (MSG91_ORDER_ALERT_TEMPLATE_ID is
 * set by the hourly msg91-template-sync cron). Never throws.
 */
export async function sendOrderAlertWhatsApp(
  order: OrderAlertOrder,
  event: OrderAlertEvent,
  itemCount?: number
): Promise<boolean> {
  try {
    const templateName = await getSetting("MSG91_ORDER_ALERT_TEMPLATE_ID");
    if (!templateName) return false;
    const supabase = getSupabaseServerClient();
    const { data: rows } = await supabase
      .from("whatsapp_messages")
      .select("order_id, template_name")
      .eq("order_id", order.id)
      .eq("template_name", orderAlertLogName(event));
    if (alreadyAlerted(rows ?? [], order.id, event)) return false;
    let count = itemCount;
    if (count == null) {
      const { data: items } = await supabase.from("order_items").select("quantity").eq("order_id", order.id);
      count = (items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    }
    const phone = normalizeAlertNumber(await getSetting("ORDER_ALERT_WHATSAPP"));
    return await sendTemplateByName(
      phone,
      orderAlertLogName(event),
      templateName,
      buildOrderAlertParams(order, count, event),
      { orderId: order.id },
      undefined,
      { internal: true }
    );
  } catch (err) {
    console.error("Order alert WhatsApp failed", order.id, event, err);
    return false;
  }
}
