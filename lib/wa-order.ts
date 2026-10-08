import type { CatalogueItem } from "./catalogue.ts";

/**
 * WhatsApp catalogue orders. Meta delivers a message of type "order"
 * (order.product_items: [{product_retailer_id, quantity, item_price, currency}]).
 * How MSG91 wraps it is unverified, so the parser finds `product_items`
 * anywhere in the payload (plain Cloud API, MSG91-wrapped, JSON strings
 * inside JSON). Prices are NEVER read from the message.
 */

export type WaOrderItem = { retailerId: string; qty: number };
export type ParsedWaOrder = {
  phone: string | null;
  name: string | null;
  messageId: string | null;
  items: WaOrderItem[];
  catalogId: string | null;
};

const MAX_DEPTH = 12;

function maybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!(s.startsWith("{") || s.startsWith("["))) return v;
  try {
    return JSON.parse(s);
  } catch {
    return v;
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Finds the first object holding a `product_items` array, with its ancestor chain (innermost first). */
function findOrderNode(node: unknown, path: Obj[], depth = 0): { order: Obj; ancestors: Obj[] } | null {
  node = maybeJson(node);
  if (depth > MAX_DEPTH || !node || typeof node !== "object") return null;
  if (isObj(node)) {
    const items = maybeJson(node.product_items);
    if (Array.isArray(items)) return { order: { ...node, product_items: items }, ancestors: [...path].reverse() };
    for (const v of Object.values(node)) {
      const hit = findOrderNode(v, [...path, node], depth + 1);
      if (hit) return hit;
    }
  } else if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findOrderNode(v, path, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function scalar(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function firstKey(objs: Obj[], keys: string[]): string | null {
  for (const o of objs) for (const k of keys) {
    const s = scalar(o[k]);
    if (s) return s;
  }
  return null;
}

function deepFind(node: unknown, pick: (o: Obj) => string | null, depth = 0): string | null {
  node = maybeJson(node);
  if (depth > MAX_DEPTH || !node || typeof node !== "object") return null;
  if (isObj(node)) {
    const got = pick(node);
    if (got) return got;
    for (const v of Object.values(node)) {
      const r = deepFind(v, pick, depth + 1);
      if (r) return r;
    }
  } else if (Array.isArray(node)) {
    for (const v of node) {
      const r = deepFind(v, pick, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

/** True when the payload looks like it is about an order even if we could not read items (store raw for inspection). */
export function looksLikeOrderPayload(payload: unknown): boolean {
  if (findOrderNode(payload, [])) return true;
  const s = typeof payload === "string" ? payload : safeStringify(payload);
  return /"type"\s*:\s*"order"|product_items|product_retailer_id/.test(s);
}

export function safeStringify(v: unknown, max = 4000): string {
  try {
    return (JSON.stringify(v) ?? "").slice(0, max);
  } catch {
    return String(v).slice(0, max);
  }
}

/** Returns null when the payload has no order at all. */
export function parseWhatsAppOrder(payload: unknown): ParsedWaOrder | null {
  const hit = findOrderNode(payload, []);
  if (!hit) return null;
  const { order, ancestors } = hit;
  const rawItems = order.product_items as unknown[];
  const items: WaOrderItem[] = [];
  for (const it of rawItems) {
    const o = maybeJson(it);
    if (!isObj(o)) continue;
    const retailerId = scalar(o.product_retailer_id) ?? scalar(o.retailer_id) ?? scalar(o.id);
    if (!retailerId) continue;
    const q = typeof o.quantity === "string" ? Number(o.quantity) : (o.quantity as number);
    items.push({ retailerId, qty: typeof q === "number" ? q : Number.NaN }); // item_price deliberately ignored
  }
  const chain = [order, ...ancestors];
  const phone = firstKey(chain, ["from", "wa_id", "customerNumber", "sender", "mobile", "phone"]) ?? deepFind(payload, (o) => firstKey([o], ["wa_id", "customerNumber"]));
  const messageId = firstKey(chain, ["id", "message_id", "messageId", "wamid"]) ?? deepFind(payload, (o) => (/^wamid\./.test(scalar(o.id) ?? "") ? scalar(o.id) : null));
  const name =
    firstKey(chain, ["customerName", "profile_name"]) ??
    deepFind(payload, (o) => (isObj(o.profile) ? scalar(o.profile.name) : null)) ??
    deepFind(payload, (o) => scalar(o.customerName));
  return { phone, name, messageId, items, catalogId: scalar(order.catalog_id) };
}

export const MAX_WA_QTY = 50;

export type CartLine = { slug: string; name: string; price: number; qty: number };
export type DroppedLine = { retailerId: string; name?: string; reason: "unknown" | "not-live" | "out-of-stock" | "bad-quantity" | "not-enough-stock" };
export type ValidatedCart = { lines: CartLine[]; total: number; dropped: DroppedLine[] };

/** Pure: catalogue = live items, inventory = slug -> stock (missing slug = no stock tracking = available). */
export function validateWaCart(
  items: WaOrderItem[],
  catalogue: Pick<CatalogueItem, "slug" | "name" | "price">[],
  inventory: Record<string, number>,
  /** slugs that exist but are not live (to give the right reason) */
  allSlugs: string[] = []
): ValidatedCart {
  const live = new Map(catalogue.map((c) => [c.slug, c]));
  const merged = new Map<string, number>();
  const dropped: DroppedLine[] = [];
  for (const it of items) {
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > MAX_WA_QTY) {
      dropped.push({ retailerId: it.retailerId, name: live.get(it.retailerId)?.name, reason: "bad-quantity" });
      continue;
    }
    if (!live.has(it.retailerId)) {
      dropped.push({ retailerId: it.retailerId, reason: allSlugs.includes(it.retailerId) ? "not-live" : "unknown" });
      continue;
    }
    merged.set(it.retailerId, (merged.get(it.retailerId) ?? 0) + it.qty);
  }
  const lines: CartLine[] = [];
  for (const [slug, qty] of merged) {
    const c = live.get(slug)!;
    const stock = inventory[slug];
    if (stock !== undefined && stock <= 0) {
      dropped.push({ retailerId: slug, name: c.name, reason: "out-of-stock" });
      continue;
    }
    if (stock !== undefined && qty > stock) {
      dropped.push({ retailerId: slug, name: c.name, reason: "not-enough-stock" });
      continue;
    }
    if (qty > MAX_WA_QTY) {
      dropped.push({ retailerId: slug, name: c.name, reason: "bad-quantity" });
      continue;
    }
    lines.push({ slug, name: c.name, price: c.price, qty });
  }
  return { lines, total: lines.reduce((s, l) => s + l.price * l.qty, 0), dropped };
}

/** Webhook retries / duplicate deliveries: reply once per inbound message id. */
export function shouldReplyToOrder(input: { messageId: string | null; alreadySeen: boolean }): boolean {
  return !input.alreadySeen;
}

/** Stable id when the provider gave none: same phone + same cart within a 10-minute bucket. */
export function syntheticOrderMessageId(phone: string, items: WaOrderItem[], now = Date.now()): string {
  const sig = items.map((i) => `${i.retailerId}x${i.qty}`).sort().join(",");
  return `waorder:${phone.replace(/\D/g, "")}:${sig}:${Math.floor(now / 600000)}`;
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const SITE = "https://www.moon-glasses.store";
export const orderLinesText = (cart: ValidatedCart, includePreview = true) =>
  cart.lines
    .map((l) =>
      includePreview
        ? `${l.qty}× ${l.name} · ${rupees(l.price * l.qty)}\nPreview: ${SITE}/chapter/${l.slug}`
        : `${l.qty}× ${l.name} · ${rupees(l.price * l.qty)}`
    )
    .join("\n\n");

const droppedText = (cart: ValidatedCart) =>
  cart.dropped.length
    ? cart.dropped.map((d) => (d.name ? `${d.name} isn't available right now.` : "One pair in your cart isn't available right now.")).join(" ")
    : null;

export type OrderOffer = { discount: number; ruleName?: string | null };

/** First reply to a cart: summary, total (with active offer applied if eligible), and the direct checkout link. */
export function buildOrderReply(cart: ValidatedCart, link?: string | null, offer?: OrderOffer | null): string {
  if (!cart.lines.length) {
    return `*Thanks For Checking In* 🕶️ ✨\n\nThe pairs in your cart aren't available right now. The full catalogue is here whenever you'd like a look: ${SITE}/catalogue`;
  }

  const hasOffer = offer && offer.discount > 0;
  const finalTotal = hasOffer ? Math.max(0, cart.total - offer.discount) : cart.total;
  const totalBlock = hasOffer
    ? `Subtotal ${rupees(cart.total)}\n${offer.ruleName ? `${offer.ruleName}, ` : "Offer applied, "}−${rupees(offer.discount)}\n*Total: ${rupees(finalTotal)}* · Free Shipping 📦`
    : `*Total: ${rupees(cart.total)}* · Free Shipping 📦`;

  if (link) {
    return [
      "*Got Your Cart* 🕶️ ✨",
      orderLinesText(cart, true),
      totalBlock,
      droppedText(cart),
      `Tap below to complete your order on our secure checkout:\n${link}`,
    ].filter(Boolean).join("\n\n");
  }
  return [
    "*Got Your Cart* 🕶️ ✨",
    orderLinesText(cart, true),
    totalBlock,
    droppedText(cart),
    "Kindly share delivery details in chat:\n✦ Name\n✦ Full Address & Pincode\n✦ Email",
    "Have a promo code? Send it along with your details.",
  ].filter(Boolean).join("\n\n");
}

/** Reply once the order exists: summary + ONE tap-to-pay link. */
export function buildPayReply(input: { cart: ValidatedCart; name: string; address: string; pincode: string; payLink: string; money?: Money }): string {
  const short = input.address.length > 60 ? `${input.address.slice(0, 57)}...` : input.address;
  const finalTotal = input.money?.total ?? input.cart.total;
  const totalLine = input.money && input.money.discount > 0
    ? `${discountLine(input.money)}*Total: ${rupees(finalTotal)}* · Free Shipping 📦`
    : `*Total: ${rupees(finalTotal)}* · Free Shipping 📦`;

  return [
    "*Order Placed* 🕶️ ✨",
    orderLinesText(input.cart, false),
    totalLine,
    `📍 *Delivering to:*\n${input.name}\n${short}, ${input.pincode}`,
    `📲 *Scan the QR here:*\n${input.payLink}`,
    "Wrong address? Reply here before it ships.",
  ].join("\n\n");
}

export type Money = { subtotal: number; discount: number; total: number };
const discountLine = (m: Money) => (m.discount > 0 ? `Code applied, −${rupees(m.discount)}\n` : "");

export const buildCodeAppliedReply = (m: Money) => `*Promo Code Applied* ✨ −${rupees(m.discount)}, *Total ${rupees(m.total)}*`;
export const buildCodeInvalidReply = () => "That promo code isn't valid right now, carrying on without it.";

/** Order created with nothing to pay (a free-pair or 100% code): no pay link. */
export function buildFreeOrderReply(input: { cart: ValidatedCart; name: string; address: string; pincode: string }): string {
  const short = input.address.length > 60 ? `${input.address.slice(0, 57)}...` : input.address;
  return [
    "*Order Placed* 🕶️ ✨",
    orderLinesText(input.cart, false),
    "*Total: ₹0* · Free Shipping 📦\nNo payment needed, we'll message you when it ships.",
    `📍 *Delivering to:*\n${input.name}\n${short}, ${input.pincode}`,
    "Wrong address? Reply here before it ships.",
  ].join("\n\n");
}

export const buildAskAgainReply = (example: string) =>
  `Couldn't read that delivery format. Could you send your name, full address and pincode in one message, like this:\n\n${example}`;

export const buildFallbackReply = (link: string) =>
  `Let's complete this on the site instead, your cart is already saved: ${link}\n\nYou can add your address and pay by UPI there.`;
