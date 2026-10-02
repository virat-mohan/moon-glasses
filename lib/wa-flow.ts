import { getSupabaseServerClient } from "@/lib/supabase";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { liveCatalogue } from "@/lib/catalogue";
import { getInventoryMap } from "@/lib/inventory";
import { sendWhatsAppSessionMessage } from "@/lib/msg91";
import { logOutboundWhatsAppMessage } from "@/lib/whatsapp-inbox";
import { sendCustomerIssueAlert } from "@/lib/email";
import { isOrderingBlocked } from "@/lib/launch";
import { createUpiOrder } from "@/lib/upi-payment";
import { getShippingRate } from "@/lib/shiprocket";
import { logTrackingEvent } from "@/lib/tracking";
import { signCartToken } from "@/lib/cart-token";
import { validateWaCart, buildOrderReply, buildPayReply, buildAskAgainReply, buildFallbackReply, buildCodeAppliedReply, buildCodeInvalidReply, buildFreeOrderReply, type ParsedWaOrder, type ValidatedCart, type WaOrderItem } from "@/lib/wa-order";
import { resolveCouponDiscount } from "@/lib/coupons";
import { resolveReferralDiscount } from "@/lib/referrals";
import { computeTrustedOrderTotal } from "@/lib/order-pricing";
import { sendWaPaidMessage } from "@/lib/wa-paid";
import { ADDRESS_EXAMPLE, bareCodeCandidates, explicitCodes, parseAddressMessage, stripCodes } from "@/lib/wa-address";
import { isSessionActive, onAddressFailure, phoneKey, startSession } from "@/lib/wa-session";

const SITE = "https://www.moon-glasses.store";
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const firstName = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] || "customer";

/** Sends a session reply, logs it in the inbox, and if it cannot be delivered emails the team the exact text. */
async function reply(phone: string, text: string, conversationId: string | null, subject: string) {
  const res = await sendWhatsAppSessionMessage(phone, text).catch((e) => ({ sent: false as const, error: String(e) }));
  if (conversationId) {
    await logOutboundWhatsAppMessage({ conversationId, body: text, providerMessageId: res.sent ? res.messageId : null, status: res.sent ? "sent" : "failed" }).catch(() => {});
  }
  if (!res.sent) {
    await sendCustomerIssueAlert("WhatsApp reply not delivered", [
      `WhatsApp reply not delivered (${subject})`,
      `Customer phone: ${phone}`,
      `Reason: ${"error" in res ? res.error : "unknown"}`,
      "Please send this text by hand:",
      text.replace(/\n/g, "<br/>"),
    ]).catch(() => {});
  }
  return res.sent;
}

async function loadCatalogue() {
  const chapters = await getAllChapters();
  return { live: liveCatalogue(chapters), allSlugs: chapters.map((c) => c.slug), stock: await getInventoryMap() };
}

async function validate(items: WaOrderItem[]): Promise<ValidatedCart> {
  const { live, allSlugs, stock } = await loadCatalogue();
  return validateWaCart(items, live, stock, allSlugs);
}

type CodeKind = { code: string; kind: "coupon" | "referral" };

/** Which of these tokens are real codes, using the same server resolvers the web uses. Explicit tokens count as codes even when invalid. */
async function classifyCodes(text: string, phone: string, subtotal: number) {
  const explicit = explicitCodes(text);
  const bare = bareCodeCandidates(text).filter((c) => !explicit.includes(c));
  const valid: CodeKind[] = [];
  const invalid: string[] = [];
  const stripped: string[] = [];
  for (const c of [...explicit, ...bare]) {
    const isExplicit = explicit.includes(c);
    let kind: CodeKind["kind"] | null = null;
    try {
      if (await resolveCouponDiscount(c, subtotal)) kind = "coupon";
      else if (await resolveReferralDiscount(c, null, phone)) kind = "referral";
    } catch {}
    if (kind) { valid.push({ code: c, kind }); stripped.push(c); }
    else if (isExplicit) { invalid.push(c); stripped.push(c); }
  }
  return { valid, invalid, stripped };
}

/** The discount the web would apply, via the trusted server pricing (never computed in chat). */
async function priceWithCodes(items: WaOrderItem[], phone: string, coupon: string | null, referral: string | null) {
  const p = await computeTrustedOrderTotal(items.map((i) => ({ slug: i.retailerId, quantity: i.qty })), undefined, undefined, referral, phone, coupon, "prepaid");
  return { subtotal: p.subtotal, discount: p.couponDiscountAmount + p.referralDiscountAmount, total: p.total };
}

/** A cart message arrived: validate, store the pending cart, ask for the address. */
export async function handleWaCartMessage(parsed: ParsedWaOrder, conversationId: string | null) {
  if (!parsed.phone) return;
  const supabase = getSupabaseServerClient();
  const cart = await validate(parsed.items);
  const key = phoneKey(parsed.phone);
  let link: string | null = null;
  if (cart.lines.length) {
    const { data: prev } = await supabase.from("wa_cart_sessions").select("id, phone, status, attempts, expires_at").eq("phone", key).eq("status", "pending").maybeSingle();
    const { abandonId, session } = startSession(prev, parsed.phone);
    if (abandonId) await supabase.from("wa_cart_sessions").update({ status: "abandoned" }).eq("id", abandonId);
    await supabase.from("wa_cart_sessions").insert({
      ...session,
      name: parsed.name,
      items: cart.lines.map((l) => ({ s: l.slug, q: l.qty })),
    });
    link = `${SITE}/cart/whatsapp?c=${signCartToken(cart.lines.map((l) => ({ s: l.slug, q: l.qty })))}`;
  }
  const sent = await reply(parsed.phone, buildOrderReply(cart), conversationId, "cart received");
  await sendCustomerIssueAlert(`WhatsApp cart: ${firstName(parsed.name)}, ${cart.lines.reduce((s, l) => s + l.qty, 0)} pairs, ${rupees(cart.total)}`, [
    `WhatsApp cart: ${firstName(parsed.name)}, ${cart.lines.reduce((s, l) => s + l.qty, 0)} pairs, ${rupees(cart.total)}`,
    sent ? "We asked for the delivery details in chat." : "The chat reply was NOT delivered (see the other email).",
    ...(link ? [`Web fallback cart: <a href="${link}">${link}</a>`] : ["Nothing in the cart is available right now."]),
    ...(cart.dropped.length ? [`Dropped: ${cart.dropped.map((d) => `${d.name ?? d.retailerId} (${d.reason})`).join(", ")}`] : []),
  ]).catch(() => {});
}

async function cityState(pincode: string) {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: AbortSignal.timeout(4000) });
    const office = (await res.json())?.[0]?.PostOffice?.[0];
    return { city: (office?.District as string) ?? null, state: (office?.State as string) ?? null };
  } catch {
    return { city: null, state: null };
  }
}

/**
 * A text from a phone with a pending cart is read as the delivery details.
 * Returns true if the message was consumed by the cart flow.
 */
export async function handleWaPendingText(input: { phone: string; text: string; profileName?: string | null; conversationId: string | null }): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const key = phoneKey(input.phone);
  const { data: s } = await supabase.from("wa_cart_sessions").select("*").eq("phone", key).eq("status", "pending").maybeSingle();
  if (!s) return false;
  if (!isSessionActive(s)) {
    await supabase.from("wa_cart_sessions").update({ status: "expired" }).eq("id", s.id);
    return false;
  }
  const items: WaOrderItem[] = (s.items as { s: string; q: number }[]).map((i) => ({ retailerId: i.s, qty: i.q }));
  const cart0 = await validate(items);
  const cls = await classifyCodes(input.text, key, cart0.total);
  const remainder = stripCodes(input.text, cls.stripped).trim();
  const codeOnly = cls.stripped.length > 0 && !/(?<![0-9])[1-9][0-9]{5}(?![0-9])/.test(remainder) && remainder.replace(/[^\p{L}]/gu, "").length < 12;
  let couponCode: string | null = s.coupon_code ?? null;
  let referralCode: string | null = s.referral_code ?? null;
  for (const v of cls.valid) {
    if (v.kind === "coupon") couponCode = v.code; else referralCode = v.code;
  }
  if (cls.valid.length) {
    await supabase.from("wa_cart_sessions").update({ coupon_code: couponCode, referral_code: referralCode }).eq("id", s.id);
  }
  if (codeOnly) {
    // A code on its own: not an address failure.
    if (cls.valid.length && cart0.lines.length) {
      const m = await priceWithCodes(items, key, couponCode, referralCode).catch(() => null);
      await reply(input.phone, m && m.discount > 0 ? buildCodeAppliedReply(m) : buildCodeInvalidReply(), input.conversationId, "code applied");
    } else {
      await reply(input.phone, buildCodeInvalidReply(), input.conversationId, "code invalid");
    }
    return true;
  }
  const invalidNote = cls.invalid.length ? `${buildCodeInvalidReply()}\n\n` : "";
  const parsed = parseAddressMessage(input.text, input.profileName ?? s.name, cls.stripped);

  if (!parsed.ok) {
    const f = onAddressFailure(s.attempts ?? 0);
    await supabase.from("wa_cart_sessions").update({ attempts: f.attempts }).eq("id", s.id);
    if (f.action === "ask-again") {
      await reply(input.phone, buildAskAgainReply(ADDRESS_EXAMPLE), input.conversationId, "address not readable");
    } else {
      const link = `${SITE}/cart/whatsapp?c=${signCartToken(items.map((i) => ({ s: i.retailerId, q: i.qty })))}`;
      await reply(input.phone, buildFallbackReply(link), input.conversationId, "address failed twice");
      await sendCustomerIssueAlert("WhatsApp cart needs a hand", [
        "WhatsApp cart: address could not be read twice",
        `Customer phone: ${input.phone}`,
        `We sent the web fallback link: <a href="${link}">${link}</a>`,
      ]).catch(() => {});
    }
    return true;
  }

  if (await isOrderingBlocked()) {
    await reply(input.phone, "we're getting ready to open and aren't taking orders just yet. we'll message you the moment we are 🌙", input.conversationId, "ordering blocked");
    return true;
  }

  const cart = await validate(items);
  if (!cart.lines.length) {
    await supabase.from("wa_cart_sessions").update({ status: "abandoned" }).eq("id", s.id);
    await reply(input.phone, buildOrderReply(cart), input.conversationId, "cart no longer available");
    return true;
  }

  const units = cart.lines.reduce((n, l) => n + l.qty, 0);
  const ship = await getShippingRate(parsed.pincode, units);
  if (ship.status === "checked_unavailable") {
    await reply(input.phone, `we can't deliver to ${parsed.pincode} yet. if there's another address you'd like it sent to, send it the same way and we'll use that.`, input.conversationId, "undeliverable pincode");
    return true;
  }
  const geo = await cityState(parsed.pincode);

  try {
    const result = await createUpiOrder({
      customer: { name: parsed.name, phone: key, email: parsed.email, address: parsed.address, city: geo.city ?? undefined, state: geo.state ?? undefined, pincode: parsed.pincode },
      items: cart.lines.map((l) => ({ slug: l.slug, quantity: l.qty })),
      couponCode,
      referralCode,
    });
    const orderId = result.orderId;
    await supabase.from("orders").update({ order_source: "whatsapp" }).eq("id", orderId);
    await supabase.from("wa_cart_sessions").update({ status: "ordered", order_id: orderId, name: parsed.name }).eq("id", s.id);
    // Channel report: the first PageView of this session carries utm_source=whatsapp.
    await logTrackingEvent("PageView", { sessionKey: `wa-${orderId}`, path: "/whatsapp-order", utmSource: "whatsapp" });
    await logTrackingEvent("InitiateCheckout", { sessionKey: `wa-${orderId}`, value: result.total });
    const money = { subtotal: cart.total, total: result.total, discount: Math.max(0, cart.total - result.total) };
    const isFree = "free" in result && result.free === true;
    const text =
      invalidNote +
      (isFree
        ? buildFreeOrderReply({ cart, name: parsed.name, address: parsed.address, pincode: parsed.pincode })
        : buildPayReply({ cart, name: parsed.name, address: parsed.address, pincode: parsed.pincode, payLink: `${SITE}/pay/${orderId}`, money }));
    // A free order was confirmed inside createUpiOrder before it was tagged; send the paid note now (deduped).
    const sent = await reply(input.phone, text, input.conversationId, isFree ? "free order" : "pay link");
    if (isFree) await sendWaPaidMessage({ id: orderId, customer_phone: key, order_source: "whatsapp" }).catch(() => {});
    await sendCustomerIssueAlert(`WhatsApp order: ${firstName(parsed.name)}, ${units} pairs, ${rupees(result.total)}`, [
      `WhatsApp order: ${firstName(parsed.name)}, ${units} pairs, ${rupees(result.total)}`,
      sent ? (isFree ? "Free order confirmed, no pay link needed." : "Pay link sent in chat.") : "The reply was NOT delivered (see the other email).",
      ...(isFree ? [] : [`Pay link: ${SITE}/pay/${orderId}`]),
    ], orderId).catch(() => {});
  } catch (err) {
    console.error("WhatsApp order creation failed", err);
    const msg = err instanceof Error ? err.message : "";
    const stock = /only \d+ of/i.test(msg);
    await reply(input.phone, stock ? `${msg.replace(/ Please lower the quantity\./, "")} send a new cart from the catalogue with fewer and we'll take it from there.` : "something went wrong on our side while placing that. we've let the team know and they'll sort it with you here.", input.conversationId, "order creation failed");
    if (!stock) await sendCustomerIssueAlert("WhatsApp order could not be created", ["WhatsApp order could not be created", `Customer phone: ${input.phone}`, `Error: ${msg}`]).catch(() => {});
  }
  return true;
}
