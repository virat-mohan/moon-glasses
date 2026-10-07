/**
 * Pure helpers for the admin Orders page (no imports, so node --test can load
 * this file directly). Presentation only: nothing here moves money, ships or
 * cancels anything. It only decides which words and filter bucket to show.
 */

export type OrderItemRow = {
  slug: string;
  /** Our (Moonglasses) model name, e.g. "Eclipse — Black". */
  name: string;
  qty: number;
  unitPrice: number;
  /** Supplier/warehouse line, shown separately and muted. Null when unknown. */
  warehouseLine: string | null;
};

export type AdminOrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_pincode: string | null;
  total: number;
  subtotal: number;
  discount_amount: number;
  shipping_charge: number;
  coupon_code_used: string | null;
  coupon_discount_amount: number;
  referral_discount_amount: number;
  loyalty_discount_amount: number;
  payment_type: string | null;
  payment_status: string | null;
  balance_due: number | null;
  status: string;
  shipment_status: string | null;
  refund_status: string | null;
  is_gift: boolean;
  gift_note: string | null;
  shiprocket_order_id: string | null;
  shiprocket_shipment_id: string | null;
  shiprocket_awb_code: string | null;
  shiprocket_label_url: string | null;
  courier_name: string | null;
  razorpay_payment_id: string | null;
  refunded_amount: number | null;
  return_shipment_id: string | null;
  is_post_barter: boolean | null;
  barter_tier: string | null;
  barter_coupon_code: string | null;
  barter_required_orders: number | null;
  barter_qualified_at: string | null;
  /** Pay With A Post: every post kit (code) and the sales on it. */
  pwap_kits?: { code: string; sales: number }[];
  is_test: boolean | null;
  upi_utr: string | null;
  order_source: string | null;
  delivered_at: string | null;
  items: OrderItemRow[];
};

export type Tone = "gold" | "cobalt" | "terracotta" | "muted" | "green" | "magenta";
export type Pill = { label: string; tone: Tone };

export type OrderBucket = "waiting" | "to_ship" | "shipped" | "delivered" | "cancelled" | "returns";
export type OrderFilter = "all" | OrderBucket;

export const FILTER_CHIPS: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Waiting for payment" },
  { key: "to_ship", label: "To ship" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "returns", label: "Returns" },
];

type ShipLike = Pick<AdminOrderRow, "shipment_status" | "status">;

function ship(o: ShipLike) {
  return (o.shipment_status ?? "not_shipped").toLowerCase();
}

export function shortId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function firstName(name: string) {
  return (name ?? "").trim().split(/\s+/)[0] || "Customer";
}

export function isWaitingForPayment(o: AdminOrderRow) {
  if (o.status === "cancelled") return false;
  if (o.payment_type === "upi_qr" && o.payment_status !== "paid") return true;
  if (o.is_post_barter && o.barter_tier === "sell_first" && !o.barter_qualified_at) return true;
  return false;
}

export function isReturn(o: AdminOrderRow) {
  const s = ship(o);
  return (
    /rto|return/.test(s) ||
    !!o.return_shipment_id ||
    o.refund_status === "requested" ||
    o.refund_status === "approved"
  );
}

/** The single filter bucket an order belongs to (every order is in exactly one). */
export function orderBucket(o: AdminOrderRow): OrderBucket {
  const s = ship(o);
  if (o.status === "cancelled" || /cancel/.test(s)) return "cancelled";
  if (isReturn(o)) return "returns";
  if (isWaitingForPayment(o)) return "waiting";
  if (/delivered/.test(s) || o.status === "delivered") return "delivered";
  if (s !== "not_shipped" || !!o.shiprocket_shipment_id) return "shipped";
  return "to_ship";
}

export function chipCounts(rows: AdminOrderRow[]): Record<OrderFilter, number> {
  const counts: Record<OrderFilter, number> = {
    all: rows.length,
    waiting: 0,
    to_ship: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    returns: 0,
  };
  for (const r of rows) counts[orderBucket(r)]++;
  return counts;
}

export function isFreeOrder(o: AdminOrderRow) {
  return Number(o.total) === 0;
}

export function paymentPill(o: AdminOrderRow): Pill {
  if (isFreeOrder(o)) return { label: "Free", tone: "green" };
  if (o.is_post_barter) {
    return { label: "Pay With A Post", tone: o.barter_qualified_at ? "gold" : "terracotta" };
  }
  if (o.payment_type === "upi_qr") {
    if (o.payment_status === "paid") return { label: "Paid", tone: "green" };
    if (o.status === "cancelled") return { label: "Not paid", tone: "muted" };
    return { label: "Waiting for payment", tone: "terracotta" };
  }
  if (o.payment_type === "cod_advance") {
    return { label: `Part paid · ₹${Number(o.balance_due ?? 0).toLocaleString("en-IN")} due`, tone: "terracotta" };
  }
  return { label: o.payment_status === "paid" ? "Paid" : "Prepaid", tone: "green" };
}

export function formatShipmentStatus(raw: string) {
  const known: Record<string, string> = {
    not_shipped: "Not shipped",
    processing: "Processing",
    ready_to_ship: "Ready to ship",
    pickup_pending: "Pickup pending",
  };
  if (known[raw]) return known[raw];
  return raw
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Shipping status in plain words (derived from Shiprocket's live status; never written back). */
export function shipPill(o: AdminOrderRow): Pill {
  const s = ship(o);
  if (o.status === "cancelled" || /cancel/.test(s)) return { label: "Cancelled", tone: "muted" };
  if (/rto/.test(s)) return { label: "Coming back (RTO)", tone: "terracotta" };
  if (/undeliver|ndr|failed/.test(s)) return { label: "Delivery problem", tone: "terracotta" };
  if (/delivered/.test(s)) return { label: "Delivered", tone: "green" };
  if (/out for delivery/.test(s)) return { label: "Out for delivery", tone: "cobalt" };
  if (s !== "not_shipped" && /transit|picked|shipped|dispatch/.test(s)) return { label: "On the way", tone: "cobalt" };
  if (["processing", "ready_to_ship", "pickup_pending", "pickup scheduled", "manifested"].some((k) => s.includes(k)))
    return { label: "Waiting for pickup", tone: "gold" };
  if (s === "not_shipped") return { label: o.shiprocket_shipment_id ? "Booked" : "Not shipped yet", tone: "gold" };
  return { label: formatShipmentStatus(o.shipment_status ?? ""), tone: "cobalt" };
}

export type SourceName = "Website" | "WhatsApp" | "Pay With A Post";

export function sourceOf(o: AdminOrderRow): SourceName {
  if (o.is_post_barter) return "Pay With A Post";
  if (o.order_source === "whatsapp") return "WhatsApp";
  return "Website";
}

/** How the customer paid, in words, for the Money section. */
export function paidHow(o: AdminOrderRow): string {
  if (isFreeOrder(o)) {
    return o.coupon_code_used ? `Free (code ${o.coupon_code_used} covered the whole order)` : "Free (nothing to pay)";
  }
  if (o.is_post_barter) {
    return o.barter_tier === "gift_first" ? "Pay With A Post (gift first)" : "Pay With A Post (sell first)";
  }
  if (o.payment_type === "upi_qr") return o.payment_status === "paid" ? "UPI QR, paid" : "UPI QR, not paid yet";
  if (o.payment_type === "cod_advance") return "Cash on delivery with advance";
  return o.razorpay_payment_id ? "Card / online (Razorpay)" : "Prepaid";
}

export function itemsSummary(items: OrderItemRow[]): string {
  if (!items.length) return "No items";
  const count = items.reduce((s, i) => s + i.qty, 0);
  return `${count} ${count === 1 ? "item" : "items"} · ${items[0].name}${items.length > 1 ? ` +${items.length - 1} more` : ""}`;
}

export function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

export type MoneyLine = { label: string; amount: string; strong?: boolean; muted?: boolean };

export function moneyLines(o: AdminOrderRow): MoneyLine[] {
  const lines: MoneyLine[] = [{ label: "Subtotal", amount: inr(o.subtotal) }];
  if (o.discount_amount > 0) lines.push({ label: "Discount", amount: `−${inr(o.discount_amount)}` });
  if (o.coupon_code_used || o.coupon_discount_amount > 0) {
    lines.push({
      label: `Code ${o.coupon_code_used ?? ""}`.trim(),
      amount: `−${inr(o.coupon_discount_amount)}`,
    });
  }
  if (o.referral_discount_amount > 0) lines.push({ label: "Referral discount", amount: `−${inr(o.referral_discount_amount)}` });
  if (o.loyalty_discount_amount > 0) lines.push({ label: "Miles used", amount: `−${inr(o.loyalty_discount_amount)}` });
  lines.push({ label: "Shipping", amount: o.shipping_charge > 0 ? inr(o.shipping_charge) : "Free" });
  lines.push({ label: "Total", amount: inr(o.total), strong: true });
  if (Number(o.refunded_amount ?? 0) > 0) lines.push({ label: "Refunded", amount: inr(Number(o.refunded_amount)), muted: true });
  return lines;
}

export function timeAgo(iso: string, now: number = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
}

/** YYYY-MM-DD in IST for date-range filtering. */
export function istDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function matchesSearch(o: AdminOrderRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[^0-9]/g, "");
  const phone = (o.customer_phone ?? "").replace(/[^0-9]/g, "");
  return (
    (o.customer_name ?? "").toLowerCase().includes(q) ||
    o.id.toLowerCase().startsWith(q.replace(/^#/, "")) ||
    (digits.length >= 3 && phone.includes(digits))
  );
}

export function filterOrders(
  rows: AdminOrderRow[],
  opts: { filter: OrderFilter; query: string; from?: string; to?: string }
) {
  return rows.filter((o) => {
    if (opts.filter !== "all" && orderBucket(o) !== opts.filter) return false;
    if (!matchesSearch(o, opts.query)) return false;
    const day = istDay(o.created_at);
    if (opts.from && day < opts.from) return false;
    if (opts.to && day > opts.to) return false;
    return true;
  });
}
