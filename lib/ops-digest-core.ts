// Pure, dependency-free digest math and rendering. No Supabase, no settings,
// no "@/..." imports, so it runs in unit tests (node --test), in the admin
// card (types only) and in the fixture preview. lib/ops-digest.ts fetches the
// raw rows and hands them here.
//
// Rules this file keeps:
// - Every number comes from the rows passed in. Nothing is estimated.
// - A section with no data is left out (null / empty), never shown as zeros.
// - Days are IST calendar days.

export type BrandInfo = { name: string; siteUrl: string };

export type RawOrder = {
  id: string;
  created_at: string;
  total: number | null;
  status: string | null;
  payment_status: string | null;
  payment_type: string | null;
  shipment_status: string | null;
  shiprocket_awb_code: string | null;
  delivery_pincode: string | null;
  delivery_city: string | null;
  delivered_at: string | null;
  rto_processed_at: string | null;
};
export type RawItem = { order_id: string; chapter_slug: string; chapter_name: string; quantity: number; unit_price: number };
export type RawEvent = { order_id: string; event_type: string; created_at: string };
export type RawReturn = { id: string; order_id: string; status: string; created_at: string };
export type RawStock = { slug: string; name: string; stock: number };
export type MonthTarget = { revenue: number | null; orders: number | null; source: string };

export type DigestInput = {
  now: Date;
  brand: BrandInfo;
  /** Orders created in the last ~35 days, any status. */
  orders: RawOrder[];
  items: RawItem[];
  /** order_events of the last ~35 days. */
  events: RawEvent[];
  /** Return requests that are open, plus any created in the last ~35 days. */
  returns: RawReturn[];
  inventory: RawStock[];
  lowStockThreshold: number;
  /** IST day -> distinct sessions. null when no analytics are recorded at all. */
  sessionsByDay: Record<string, number> | null;
  /** IST day -> ad spend (₹). null when Meta ads aren't connected. */
  adSpendByDay: Record<string, number> | null;
  /** This month's target, or null when none is stored. */
  target: MonthTarget | null;
};

export type Direction = "up" | "down" | "flat";
export type Delta = { abs: number; pct: number | null; dir: Direction };
export type Format = "inr" | "count" | "pct" | "ratio";

export type Metric = {
  key: string;
  label: string;
  value: number;
  format: Format;
  vsWeek: Delta | null;
  vsAvg: Delta | null;
  /** true when "up" is good news (revenue), false when it's bad (RTOs). */
  upIsGood: boolean;
  note?: string;
};

export type Goal = {
  label: string;
  format: Format;
  actual: number;
  target: number;
  expectedByNow: number;
  onTrack: boolean;
  gap: number;
  perDayNeeded: number | null;
  line: string;
};

export type Insight = { title: string; detail: string; why: string | null; impact: number; tone: "good" | "bad" };

export type Need = {
  key: string;
  title: string;
  reason: string;
  outcome: string;
  href: string;
  count: number;
  /** ₹ tied up in it — used to order the list. */
  money: number;
};

export type Shipping = {
  windowDays: number;
  delivered: number;
  inTransit: number;
  awaitingPickup: number;
  stuck: number;
  ndr: number;
  rto: number;
};

export type StockRow = { name: string; stock: number; unitsPerDay: number; daysOfCover: number | null; unitPrice: number };

export type Digest = {
  brand: BrandInfo;
  day: string;
  dayLabel: string;
  weekdayName: string;
  headline: string;
  scorecard: Metric[];
  goals: Goal[];
  goalNote: string | null;
  insights: Insight[];
  needs: Need[];
  shipping: Shipping | null;
  stock: StockRow[];
  gaps: string[];
};

// ---------- time ----------

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function istDay(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
/** UTC instant at which an IST day starts. */
export function istDayStartIso(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS).toISOString();
}
function weekday(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}
function prettyDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

// ---------- formatting ----------

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
export function formatValue(n: number, f: Format): string {
  if (f === "inr") return inr(n);
  if (f === "pct") return `${(n * 100).toFixed(n * 100 < 10 ? 1 : 0)}%`;
  if (f === "ratio") return `${n.toFixed(1)}×`;
  return Math.round(n) === n ? n.toLocaleString("en-IN") : n.toFixed(1);
}
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------- deltas ----------

/** Change from `base` to `current`. pct is null when base is 0 (no honest %). */
export function delta(current: number, base: number, flatWithinPct = 2): Delta {
  const abs = current - base;
  const pct = base === 0 ? null : abs / Math.abs(base);
  let dir: Direction = abs > 0 ? "up" : abs < 0 ? "down" : "flat";
  if (pct !== null && Math.abs(pct) * 100 < flatWithinPct) dir = "flat";
  return { abs, pct, dir };
}
export function arrow(dir: Direction) {
  return dir === "up" ? "▲" : dir === "down" ? "▼" : "▬";
}
export function describeDelta(d: Delta, f: Format): string {
  if (d.dir === "flat") return "level";
  if (f === "pct") return `${d.abs > 0 ? "+" : "−"}${Math.abs(d.abs * 100).toFixed(1)} pts`;
  if (d.pct === null) return `${d.abs > 0 ? "+" : "−"}${formatValue(Math.abs(d.abs), f)}`;
  return `${d.pct > 0 ? "+" : "−"}${Math.abs(Math.round(d.pct * 100))}%`;
}

// ---------- per-day aggregates ----------

type DayStats = { orders: number; revenue: number };

function isLive(o: RawOrder) {
  return o.status !== "cancelled";
}

function dayStats(orders: RawOrder[], day: string): DayStats {
  let n = 0;
  let rev = 0;
  for (const o of orders) {
    if (!isLive(o) || istDay(o.created_at) !== day) continue;
    n += 1;
    rev += o.total ?? 0;
  }
  return { orders: n, revenue: rev };
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// ---------- shipping classification ----------

const RTO_RE = /rto|return to origin|returned to origin/i;
const DELIVERED_RE = /delivered/i;
const NDR_RE = /ndr|undeliver|delivery fail|delivery attempt|not available|consignee/i;
const PICKUP_RE = /ready_to_ship|pickup|manifest|awb assigned/i;
const NOT_SHIPPED = new Set(["not_shipped", "processing", ""]);

export type ShipClass = "not_shipped" | "awaiting_pickup" | "in_transit" | "ndr" | "delivered" | "rto";

export function classifyShipment(o: RawOrder): ShipClass {
  const s = (o.shipment_status ?? "").toLowerCase();
  if (o.rto_processed_at || RTO_RE.test(s)) return "rto";
  if (o.delivered_at || DELIVERED_RE.test(s)) return "delivered";
  if (NOT_SHIPPED.has(s)) return "not_shipped";
  if (NDR_RE.test(s)) return "ndr";
  if (PICKUP_RE.test(s)) return "awaiting_pickup";
  return "in_transit";
}

// ---------- needs you today ----------

export function computeNeeds(
  input: Pick<DigestInput, "now" | "orders" | "events" | "returns" | "brand" | "lowStockThreshold">,
  stock: StockRow[]
): Need[] {
  const now = input.now.getTime();
  const admin = `${input.brand.siteUrl}/admin`;
  const needs: Need[] = [];
  const live = input.orders.filter(isLive);
  const sum = (os: RawOrder[]) => os.reduce((s, o) => s + (o.total ?? 0), 0);
  const age = (o: RawOrder) => now - Date.parse(o.created_at);

  const unshipped = live.filter((o) => o.payment_status !== "unpaid" && classifyShipment(o) === "not_shipped" && age(o) > 48 * HOUR_MS);
  if (unshipped.length) {
    const oldest = Math.floor(Math.max(...unshipped.map(age)) / DAY_MS);
    needs.push({
      key: "unshipped",
      title: `Ship ${plural(unshipped.length, "order")} waiting over 48 hours`,
      reason: `Paid and not handed to a courier. The oldest is ${plural(oldest, "day")} old.`,
      outcome: "They leave today, before anyone has to ask where their order is.",
      href: `${admin}/logistics`,
      count: unshipped.length,
      money: sum(unshipped),
    });
  }

  const noScan = live.filter((o) => o.shiprocket_awb_code && classifyShipment(o) === "awaiting_pickup" && age(o) > 48 * HOUR_MS);
  if (noScan.length) {
    needs.push({
      key: "no_scan",
      title: `Chase pickup on ${plural(noScan.length, "AWB")} with no courier scan`,
      reason: "A label exists but the courier hasn't logged a single movement in over 48 hours.",
      outcome: "A pickup gets booked, or I learn the parcel was never handed over.",
      href: `${admin}/logistics`,
      count: noScan.length,
      money: sum(noScan),
    });
  }

  const ndr = live.filter((o) => classifyShipment(o) === "ndr");
  if (ndr.length) {
    needs.push({
      key: "ndr",
      title: `Save ${plural(ndr.length, "failed delivery", "failed deliveries")}`,
      reason: "The courier couldn't deliver. Without a reattempt these turn into RTOs.",
      outcome: "A quick call and a reattempt instead of paying shipping both ways.",
      href: `${admin}/logistics`,
      count: ndr.length,
      money: sum(ndr),
    });
  }

  const stuck = live.filter((o) => classifyShipment(o) === "in_transit" && age(o) > 7 * DAY_MS);
  if (stuck.length) {
    needs.push({
      key: "stuck",
      title: `Check ${plural(stuck.length, "parcel")} in transit over 7 days`,
      reason: "Most deliveries land within a week; these haven't.",
      outcome: "An escalation with the courier before the customer writes in.",
      href: `${admin}/logistics`,
      count: stuck.length,
      money: sum(stuck),
    });
  }

  // Refund failures with no later successful refund on the same order.
  const refundedOrders = new Set(input.events.filter((e) => /refunded$/.test(e.event_type)).map((e) => e.order_id));
  const failedIds = [
    ...new Set(input.events.filter((e) => /refund_failed$/.test(e.event_type) && !refundedOrders.has(e.order_id)).map((e) => e.order_id)),
  ];
  if (failedIds.length) {
    const byId = new Map(input.orders.map((o) => [o.id, o]));
    needs.push({
      key: "refund_failed",
      title: `Retry ${plural(failedIds.length, "refund")} that failed`,
      reason: "The automatic refund didn't go through, so the customer is still out of pocket.",
      outcome: "Money back with the customer, and a promise kept.",
      href: `${admin}/orders`,
      count: failedIds.length,
      money: failedIds.reduce((s, id) => s + (byId.get(id)?.total ?? 0), 0),
    });
  }

  const byId = new Map(input.orders.map((o) => [o.id, o]));
  const toDecide = input.returns.filter((r) => r.status === "requested");
  if (toDecide.length) {
    needs.push({
      key: "returns_requested",
      title: `Decide ${plural(toDecide.length, "return request")}`,
      reason: "Customers are waiting for a yes or no.",
      outcome: "A same-day answer, which is what I promise.",
      href: `${admin}/returns`,
      count: toDecide.length,
      money: toDecide.reduce((s, r) => s + (byId.get(r.order_id)?.total ?? 0), 0),
    });
  }
  const toRefund = input.returns.filter((r) => r.status === "received");
  if (toRefund.length) {
    needs.push({
      key: "returns_received",
      title: `Refund ${plural(toRefund.length, "returned order")}`,
      reason: "The parcel is back with me and the refund hasn't been issued.",
      outcome: "The customer is paid back and the return is closed.",
      href: `${admin}/returns`,
      count: toRefund.length,
      money: toRefund.reduce((s, r) => s + (byId.get(r.order_id)?.total ?? 0), 0),
    });
  }

  const unpaid = live.filter((o) => o.payment_status === "unpaid" && (o.payment_type ?? "prepaid") === "prepaid" && age(o) > 24 * HOUR_MS);
  if (unpaid.length) {
    needs.push({
      key: "unpaid",
      title: `Resolve ${plural(unpaid.length, "unpaid order")}`,
      reason: "Placed over 24 hours ago with no payment recorded (failed or unconfirmed).",
      outcome: "Either the payment is confirmed and it ships, or the order is cancelled cleanly.",
      href: `${admin}/orders`,
      count: unpaid.length,
      money: sum(unpaid),
    });
  }

  const low = stock.filter((s) => s.stock <= input.lowStockThreshold || (s.daysOfCover !== null && s.daysOfCover < 14));
  if (low.length) {
    const list = low
      .slice(0, 3)
      .map((s) => (s.stock <= 0 ? `${s.name} (sold out)` : `${s.name} (~${plural(Math.floor(s.daysOfCover ?? 0), "day")})`))
      .join(", ");
    needs.push({
      key: "low_stock",
      title: `Reorder ${plural(low.length, "top seller")}`,
      reason: `At the last 14 days' pace: ${list}.`,
      outcome: "No sold-out page on a product people are already buying.",
      href: `${admin}/inventory`,
      count: low.length,
      // Sales lost over the next 14 days if nothing is reordered.
      money: Math.round(low.reduce((s, r) => s + Math.max(0, 14 - (r.daysOfCover ?? 0)) * r.unitsPerDay * r.unitPrice, 0)),
    });
  }

  return needs.sort((a, b) => b.money - a.money);
}

// ---------- insights ----------

/** Keeps the candidates with real money behind them, biggest first. */
export function rankInsights(candidates: Insight[], limit = 3): Insight[] {
  return candidates
    .filter((c) => Number.isFinite(c.impact) && c.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit);
}

function productRevenue(input: DigestInput, days: Set<string>) {
  const orderDay = new Map(input.orders.filter(isLive).map((o) => [o.id, istDay(o.created_at)]));
  const m = new Map<string, { units: number; revenue: number }>();
  for (const it of input.items) {
    const d = orderDay.get(it.order_id);
    if (!d || !days.has(d)) continue;
    const row = m.get(it.chapter_name) ?? { units: 0, revenue: 0 };
    row.units += it.quantity;
    row.revenue += it.quantity * it.unit_price;
    m.set(it.chapter_name, row);
  }
  return m;
}

function range(from: string, n: number) {
  return new Set(Array.from({ length: n }, (_, i) => addDays(from, i)));
}

function buildInsights(input: DigestInput, y: string, ctx: { yd: DayStats; wk: DayStats; avgOrders: number; avgRevenue: number; avgAov: number }): Insight[] {
  const out: Insight[] = [];
  const wd = weekday(y);
  const lw = addDays(y, -7);

  // 1. Revenue vs same weekday, with the product that moved most.
  const dRev = ctx.yd.revenue - ctx.wk.revenue;
  if (dRev !== 0) {
    const a = productRevenue(input, new Set([y]));
    const b = productRevenue(input, new Set([lw]));
    let top: { name: string; d: number } | null = null;
    for (const name of new Set([...a.keys(), ...b.keys()])) {
      const d = (a.get(name)?.revenue ?? 0) - (b.get(name)?.revenue ?? 0);
      if (Math.sign(d) === Math.sign(dRev) && (!top || Math.abs(d) > Math.abs(top.d))) top = { name, d };
    }
    const share = top ? Math.abs(top.d) / Math.abs(dRev) : 0;
    out.push({
      title: `Revenue ${dRev > 0 ? "up" : "down"} ${inr(Math.abs(dRev))} on last ${wd}`,
      detail: `${inr(ctx.yd.revenue)} from ${plural(ctx.yd.orders, "order")}, against ${inr(ctx.wk.revenue)} from ${plural(ctx.wk.orders, "order")}.`,
      why: top && share >= 0.4 ? `${top.name} accounts for ${inr(Math.abs(top.d))} of the ${dRev > 0 ? "rise" : "drop"}.` : null,
      impact: Math.abs(dRev),
      tone: dRev > 0 ? "good" : "bad",
    });
  }

  // 2. Basket size vs the 7-day average.
  if (ctx.yd.orders > 0 && ctx.avgAov > 0) {
    const aov = ctx.yd.revenue / ctx.yd.orders;
    const d = delta(aov, ctx.avgAov);
    if (d.pct !== null && Math.abs(d.pct) >= 0.1) {
      const yIds = new Set(input.orders.filter((o) => isLive(o) && istDay(o.created_at) === y).map((o) => o.id));
      const units = new Map<string, number>();
      for (const it of input.items) if (yIds.has(it.order_id)) units.set(it.order_id, (units.get(it.order_id) ?? 0) + it.quantity);
      const multi = [...units.values()].filter((u) => u > 1).length;
      out.push({
        title: `Average order ${d.abs > 0 ? "up" : "down"} to ${inr(aov)}`,
        detail: `${describeDelta(d, "inr")} against the 7-day average of ${inr(ctx.avgAov)}.`,
        why: units.size ? `${multi} of ${plural(units.size, "order")} had more than one item.` : null,
        impact: Math.abs(d.abs) * ctx.yd.orders,
        tone: d.abs > 0 ? "good" : "bad",
      });
    }
  }

  // 3. Conversion vs the 7-day average.
  if (input.sessionsByDay) {
    const s = input.sessionsByDay[y] ?? 0;
    const prior = Array.from({ length: 7 }, (_, i) => addDays(y, -7 + i));
    const ps = prior.reduce((a, d) => a + (input.sessionsByDay?.[d] ?? 0), 0);
    const po = prior.reduce((a, d) => a + dayStats(input.orders, d).orders, 0);
    if (s > 0 && ps > 0) {
      const c = ctx.yd.orders / s;
      const pc = po / ps;
      const d = delta(c, pc);
      if (Math.abs(d.abs) >= 0.002 && (d.pct === null || Math.abs(d.pct) >= 0.15)) {
        out.push({
          title: `Conversion ${d.abs > 0 ? "up" : "down"} to ${formatValue(c, "pct")}`,
          detail: `${plural(ctx.yd.orders, "order")} from ${plural(s, "visit")}, against ${formatValue(pc, "pct")} over the prior 7 days.`,
          why: s < ps / 7 * 0.7 ? "Traffic was also light, so this may be a small-sample swing." : null,
          impact: Math.abs(d.abs) * s * (ctx.avgAov || (ctx.yd.orders ? ctx.yd.revenue / ctx.yd.orders : 0)),
          tone: d.abs > 0 ? "good" : "bad",
        });
      }
    }
  }

  // 4. Ad efficiency vs the 7-day average.
  if (input.adSpendByDay) {
    const spend = input.adSpendByDay[y] ?? 0;
    const prior = Array.from({ length: 7 }, (_, i) => addDays(y, -7 + i));
    const pSpend = prior.reduce((a, d) => a + (input.adSpendByDay?.[d] ?? 0), 0);
    const pRev = prior.reduce((a, d) => a + dayStats(input.orders, d).revenue, 0);
    if (spend > 0 && pSpend > 0) {
      const roas = ctx.yd.revenue / spend;
      const pRoas = pRev / pSpend;
      const d = delta(roas, pRoas);
      if (d.pct !== null && Math.abs(d.pct) >= 0.15) {
        out.push({
          title: `ROAS ${d.abs > 0 ? "up" : "down"} to ${formatValue(roas, "ratio")}`,
          detail: `${inr(spend)} spent for ${inr(ctx.yd.revenue)} in orders, against ${formatValue(pRoas, "ratio")} over the prior 7 days.`,
          why: null,
          impact: Math.abs(roas - pRoas) * spend,
          tone: d.abs > 0 ? "good" : "bad",
        });
      }
    }
  }

  // 5. RTOs in the last 7 days, with where and how they were paid.
  const last7 = range(addDays(y, -6), 7);
  const rtoIds = [...new Set(input.events.filter((e) => e.event_type === "rto_initiated" && last7.has(istDay(e.created_at))).map((e) => e.order_id))];
  if (rtoIds.length) {
    const byId = new Map(input.orders.map((o) => [o.id, o]));
    const rtoOrders = rtoIds.map((id) => byId.get(id)).filter((o): o is RawOrder => !!o);
    const prev7 = range(addDays(y, -13), 7);
    const prevCount = new Set(input.events.filter((e) => e.event_type === "rto_initiated" && prev7.has(istDay(e.created_at))).map((e) => e.order_id)).size;
    const reasons: string[] = [];
    const cod = rtoOrders.filter((o) => o.payment_type === "cod_advance").length;
    if (cod > 0) reasons.push(`${cod} of ${rtoOrders.length} were cash on delivery`);
    const count = (key: (o: RawOrder) => string | null) => {
      const m = new Map<string, number>();
      for (const o of rtoOrders) {
        const k = key(o);
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    };
    const pin = count((o) => o.delivery_pincode);
    const city = count((o) => o.delivery_city);
    if (pin && pin[1] > 1) reasons.push(`${pin[1]} of ${rtoOrders.length} went to pincode ${pin[0]}`);
    else if (city && city[1] > 1) reasons.push(`${city[1]} of ${rtoOrders.length} went to ${city[0]}`);
    out.push({
      title: `${plural(rtoIds.length, "RTO")} this week${prevCount ? `, ${rtoIds.length > prevCount ? "up" : rtoIds.length < prevCount ? "down" : "level"} from ${prevCount}` : ""}`,
      detail: `${inr(rtoOrders.reduce((s, o) => s + (o.total ?? 0), 0))} of orders coming back instead of being delivered.`,
      why: reasons.length ? `${reasons.join("; ")}.` : null,
      impact: rtoOrders.reduce((s, o) => s + (o.total ?? 0), 0),
      tone: "bad",
    });
  }

  // 6. The product whose week moved most (last 7 days vs the 7 before).
  const now7 = productRevenue(input, last7);
  const prior7 = productRevenue(input, range(addDays(y, -13), 7));
  let mover: { name: string; d: number; u: number; pu: number } | null = null;
  for (const name of new Set([...now7.keys(), ...prior7.keys()])) {
    const d = (now7.get(name)?.revenue ?? 0) - (prior7.get(name)?.revenue ?? 0);
    if (!mover || Math.abs(d) > Math.abs(mover.d)) mover = { name, d, u: now7.get(name)?.units ?? 0, pu: prior7.get(name)?.units ?? 0 };
  }
  if (mover && mover.d !== 0) {
    out.push({
      title: `${mover.name} ${mover.d > 0 ? "is picking up" : "has slowed"}`,
      detail: `${plural(mover.u, "unit")} in the last 7 days, against ${mover.pu} the week before (${mover.d > 0 ? "+" : "−"}${inr(Math.abs(mover.d))}).`,
      why: null,
      impact: Math.abs(mover.d),
      tone: mover.d > 0 ? "good" : "bad",
    });
  }

  return out;
}

// ---------- stock ----------

export function computeStock(input: Pick<DigestInput, "orders" | "items" | "inventory">, y: string, topN = 5): StockRow[] {
  const days = range(addDays(y, -13), 14);
  const bySlug = new Map<string, number>();
  const price = new Map<string, number>();
  const live = new Map(input.orders.filter(isLive).map((o) => [o.id, istDay(o.created_at)]));
  for (const it of input.items) {
    const d = live.get(it.order_id);
    if (d && days.has(d)) {
      bySlug.set(it.chapter_slug, (bySlug.get(it.chapter_slug) ?? 0) + it.quantity);
      price.set(it.chapter_slug, it.unit_price);
    }
  }
  return input.inventory
    .filter((s) => (bySlug.get(s.slug) ?? 0) > 0)
    .map((s) => {
      const perDay = (bySlug.get(s.slug) ?? 0) / 14;
      return { name: s.name, stock: s.stock, unitsPerDay: perDay, daysOfCover: perDay > 0 ? Math.max(0, s.stock) / perDay : null, unitPrice: price.get(s.slug) ?? 0 };
    })
    .sort((a, b) => b.unitsPerDay - a.unitsPerDay)
    .slice(0, topN);
}

// ---------- the whole digest ----------

export function buildDigest(input: DigestInput): Digest {
  const y = addDays(istDay(input.now), -1);
  const lw = addDays(y, -7);
  const prior = Array.from({ length: 7 }, (_, i) => addDays(y, -7 + i));
  const wd = weekday(y);
  const gaps: string[] = [];

  const yd = dayStats(input.orders, y);
  const wk = dayStats(input.orders, lw);
  const priorStats = prior.map((d) => dayStats(input.orders, d));
  const avgOrders = avg(priorStats.map((s) => s.orders));
  const avgRevenue = avg(priorStats.map((s) => s.revenue));
  const priorOrders = priorStats.reduce((a, s) => a + s.orders, 0);
  const avgAov = priorOrders ? priorStats.reduce((a, s) => a + s.revenue, 0) / priorOrders : 0;
  const anyOrders = input.orders.some(isLive);

  // Headline
  let headline: string;
  if (!anyOrders) {
    headline = "No orders in the last five weeks yet, so there is nothing to compare. Everything below is what needs you.";
  } else {
    const vsWeek =
      wk.revenue === 0
        ? yd.revenue === 0
          ? `the same as last ${wd}`
          : `against nothing last ${wd}`
        : `${describeDelta(delta(yd.revenue, wk.revenue), "inr").replace("level", "level with")}${delta(yd.revenue, wk.revenue).dir === "flat" ? "" : " on"} last ${wd}`;
    const vsAvgD = delta(yd.revenue, avgRevenue);
    const vsAvg =
      avgRevenue === 0
        ? "with no sales in the week before"
        : vsAvgD.dir === "flat"
          ? "level with the 7-day average"
          : `${Math.abs(Math.round((vsAvgD.pct ?? 0) * 100))}% ${vsAvgD.abs > 0 ? "above" : "below"} the 7-day average`;
    headline =
      yd.orders === 0
        ? `No orders yesterday (${wd}); last ${wd} brought ${inr(wk.revenue)} and the 7-day average is ${inr(avgRevenue)} a day.`
        : `Yesterday brought ${inr(yd.revenue)} from ${plural(yd.orders, "order")}: ${vsWeek}, and ${vsAvg}.`;
  }

  // Scorecard
  const scorecard: Metric[] = [];
  if (anyOrders) {
    scorecard.push({ key: "orders", label: "Orders", value: yd.orders, format: "count", vsWeek: delta(yd.orders, wk.orders), vsAvg: delta(yd.orders, avgOrders), upIsGood: true });
    scorecard.push({ key: "revenue", label: "Revenue", value: yd.revenue, format: "inr", vsWeek: delta(yd.revenue, wk.revenue), vsAvg: delta(yd.revenue, avgRevenue), upIsGood: true });
    if (yd.orders > 0) {
      const aov = yd.revenue / yd.orders;
      scorecard.push({
        key: "aov",
        label: "Avg order",
        value: aov,
        format: "inr",
        vsWeek: wk.orders ? delta(aov, wk.revenue / wk.orders) : null,
        vsAvg: avgAov ? delta(aov, avgAov) : null,
        upIsGood: true,
      });
    }
  }
  if (input.sessionsByDay) {
    const s = input.sessionsByDay[y] ?? 0;
    const sw = input.sessionsByDay[lw] ?? 0;
    const ps = prior.reduce((a, d) => a + (input.sessionsByDay?.[d] ?? 0), 0);
    if (s > 0) {
      const c = yd.orders / s;
      scorecard.push({
        key: "conversion",
        label: "Conversion",
        value: c,
        format: "pct",
        vsWeek: sw ? delta(c, wk.orders / sw, 0) : null,
        vsAvg: ps ? delta(c, priorOrders / ps, 0) : null,
        upIsGood: true,
        note: `${plural(s, "visit")}`,
      });
    } else gaps.push("No site visits were recorded yesterday, so conversion is left out.");
  } else gaps.push("No site analytics are recorded yet, so conversion is left out.");
  if (input.adSpendByDay) {
    const spend = input.adSpendByDay[y] ?? 0;
    const sw = input.adSpendByDay[lw] ?? 0;
    const pSpend = prior.map((d) => input.adSpendByDay?.[d] ?? 0);
    if (spend > 0 || sw > 0 || pSpend.some((x) => x > 0)) {
      scorecard.push({ key: "spend", label: "Ad spend", value: spend, format: "inr", vsWeek: delta(spend, sw), vsAvg: delta(spend, avg(pSpend)), upIsGood: false });
      if (spend > 0) {
        const r = yd.revenue / spend;
        const pTot = pSpend.reduce((a, b) => a + b, 0);
        scorecard.push({
          key: "roas",
          label: "ROAS",
          value: r,
          format: "ratio",
          vsWeek: sw ? delta(r, wk.revenue / sw) : null,
          vsAvg: pTot ? delta(r, priorStats.reduce((a, s) => a + s.revenue, 0) / pTot) : null,
          upIsGood: true,
          note: "all orders ÷ Meta spend",
        });
      }
    } else gaps.push("Meta ads are connected but spent nothing in the last 8 days.");
  } else gaps.push("Meta ads aren't connected, so ad spend and ROAS are left out.");

  const rtoOn = (d: string) => new Set(input.events.filter((e) => e.event_type === "rto_initiated" && istDay(e.created_at) === d).map((e) => e.order_id)).size;
  const retOn = (d: string) => input.returns.filter((r) => istDay(r.created_at) === d).length;
  const hasReturnData = input.events.some((e) => e.event_type === "rto_initiated") || input.returns.length > 0;
  if (hasReturnData) {
    const r = rtoOn(y) + retOn(y);
    scorecard.push({
      key: "returns",
      label: "Returns + RTO",
      value: r,
      format: "count",
      vsWeek: delta(r, rtoOn(lw) + retOn(lw)),
      vsAvg: delta(r, avg(prior.map((d) => rtoOn(d) + retOn(d)))),
      upIsGood: false,
      note: `${rtoOn(y)} RTO · ${retOn(y)} return`,
    });
  }

  // Goals (month to date through yesterday)
  const goals: Goal[] = [];
  let goalNote: string | null = null;
  const monthStart = `${y.slice(0, 8)}01`;
  const daysInMonth = new Date(Date.UTC(Number(y.slice(0, 4)), Number(y.slice(5, 7)), 0)).getUTCDate();
  const elapsed = Number(y.slice(8, 10));
  const remaining = daysInMonth - elapsed;
  const monthName = new Date(`${y}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const mtd = Array.from({ length: elapsed }, (_, i) => dayStats(input.orders, addDays(monthStart, i))).reduce(
    (a, s) => ({ orders: a.orders + s.orders, revenue: a.revenue + s.revenue }),
    { orders: 0, revenue: 0 }
  );
  const goalFor = (label: string, format: Format, actual: number, target: number): Goal => {
    const expected = (target * elapsed) / daysInMonth;
    const onTrack = actual >= expected;
    const gap = Math.max(0, expected - actual);
    const perDayNeeded = remaining > 0 ? Math.max(0, target - actual) / remaining : null;
    const f = (n: number) => formatValue(format === "count" ? Math.ceil(n) : n, format);
    const line =
      `${monthName} ${label.toLowerCase()}: ${f(actual)} of ${f(target)}, ` +
      (onTrack ? "on track" : `behind pace by ${f(gap)}`) +
      (perDayNeeded !== null && actual < target ? `. ${f(perDayNeeded)} a day for the last ${plural(remaining, "day")} reaches it.` : actual >= target ? ". Target reached." : ".");
    return { label, format, actual, target, expectedByNow: expected, onTrack, gap, perDayNeeded, line };
  };
  if (input.target && (input.target.revenue || input.target.orders)) {
    if (input.target.revenue) goals.push(goalFor("Revenue", "inr", mtd.revenue, input.target.revenue));
    if (input.target.orders) goals.push(goalFor("Orders", "count", mtd.orders, input.target.orders));
  } else {
    goalNote = `No target is stored for ${monthName}. I'd set one in the business plan (${input.brand.siteUrl}/admin/business-plan) and this line will track it daily.`;
    gaps.push(`No monthly target is stored for ${monthName}.`);
  }

  // Shipping (orders of the last 30 days that have left the building or should have)
  const since30 = Date.parse(istDayStartIso(addDays(y, -29)));
  const recent = input.orders.filter((o) => isLive(o) && Date.parse(o.created_at) >= since30);
  let shipping: Shipping | null = null;
  const nowMs = input.now.getTime();
  if (recent.some((o) => classifyShipment(o) !== "not_shipped")) {
    const cls = recent.map((o) => ({ o, c: classifyShipment(o) }));
    const age = (o: RawOrder) => nowMs - Date.parse(o.created_at);
    shipping = {
      windowDays: 30,
      delivered: cls.filter((x) => x.c === "delivered").length,
      inTransit: cls.filter((x) => x.c === "in_transit").length,
      awaitingPickup: cls.filter((x) => x.c === "awaiting_pickup").length,
      ndr: cls.filter((x) => x.c === "ndr").length,
      rto: cls.filter((x) => x.c === "rto").length,
      stuck: cls.filter((x) => (x.c === "in_transit" && age(x.o) > 7 * DAY_MS) || (x.c === "awaiting_pickup" && age(x.o) > 48 * HOUR_MS)).length,
    };
  }

  const stock = computeStock(input, y);
  const needs = computeNeeds(input, stock);
  const insights = rankInsights(buildInsights(input, y, { yd, wk, avgOrders, avgRevenue, avgAov }));

  return {
    brand: input.brand,
    day: y,
    dayLabel: prettyDay(y),
    weekdayName: wd,
    headline,
    scorecard,
    goals,
    goalNote,
    insights,
    needs,
    shipping,
    stock,
    gaps,
  };
}

// ---------- rendering: email ----------

export const PALETTE = {
  paper: "#f4ead4",
  card: "#fbf6ea",
  ink: "#1a1410",
  dim: "#5a4c3c",
  line: "#e2d6bb",
  gold: "#d4af37",
  terracotta: "#d9714b",
  cobalt: "#3e6fa6",
  magenta: "#e91e8c",
  bronze: "#9c7a4a",
  good: "#2f6b4f",
  bad: "#a4482a",
};
const DISPLAY = "Anton, Impact, 'Arial Narrow Bold', 'Arial Narrow', Arial, sans-serif";
const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function deltaTone(d: Delta | null, upIsGood: boolean): "good" | "bad" | "flat" {
  if (!d || d.dir === "flat") return "flat";
  return (d.dir === "up") === upIsGood ? "good" : "bad";
}

function deltaHtml(d: Delta | null, m: Metric, label: string) {
  if (!d) return `<span style="color:${PALETTE.dim};">— ${label}</span>`;
  const t = deltaTone(d, m.upIsGood);
  const c = t === "good" ? PALETTE.good : t === "bad" ? PALETTE.bad : PALETTE.dim;
  return `<span style="color:${c};">${arrow(d.dir)} ${esc(describeDelta(d, m.format))}</span> <span style="color:${PALETTE.dim};">${label}</span>`;
}

function sectionTitle(text: string, colour: string) {
  return `<tr><td style="padding:32px 28px 10px 28px;" class="px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:8px;height:8px;background:${colour};border-radius:8px;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding-left:10px;font-family:${DISPLAY};font-size:20px;line-height:24px;letter-spacing:0.5px;text-transform:uppercase;color:${PALETTE.ink};">${esc(text)}</td>
    </tr></table>
  </td></tr>`;
}

export function renderDigestEmail(d: Digest): { subject: string; preheader: string; html: string; text: string } {
  const P = PALETTE;
  const subject = `${d.brand.name} · ${d.weekdayName}: ${d.scorecard.find((m) => m.key === "revenue") ? `${inr(d.scorecard.find((m) => m.key === "revenue")!.value)}, ${plural(d.scorecard.find((m) => m.key === "orders")!.value, "order")}` : "daily digest"}${d.needs.length ? ` · ${d.needs.length} for you today` : ""}`;
  const preheader = d.headline;
  const rows: string[] = [];

  // Scorecard: two tiles per row (stays two-up on a phone, 600px on desktop).
  if (d.scorecard.length) {
    rows.push(sectionTitle("Scorecard", P.terracotta));
    const tiles = d.scorecard.map(
      (m) => `<td class="tile" width="50%" valign="top" style="width:50%;padding:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.card};border:1px solid ${P.line};border-radius:12px;">
          <tr><td style="padding:14px 16px 14px 16px;">
            <div style="font-family:${SANS};font-size:11px;line-height:14px;letter-spacing:1.5px;text-transform:uppercase;color:${P.dim};">${esc(m.label)}</div>
            <div style="font-family:${SERIF};font-size:30px;line-height:36px;color:${P.ink};padding-top:2px;">${esc(formatValue(m.value, m.format))}</div>
            <div style="font-family:${SANS};font-size:12px;line-height:18px;">${deltaHtml(m.vsWeek, m, `vs last ${d.weekdayName.slice(0, 3)}`)}</div>
            <div style="font-family:${SANS};font-size:12px;line-height:18px;">${deltaHtml(m.vsAvg, m, "vs 7-day avg")}</div>
            ${m.note ? `<div style="font-family:${SANS};font-size:11px;line-height:16px;color:${P.dim};padding-top:4px;">${esc(m.note)}</div>` : ""}
          </td></tr>
        </table>
      </td>`
    );
    const trs: string[] = [];
    for (let i = 0; i < tiles.length; i += 2) trs.push(`<tr>${tiles[i]}${tiles[i + 1] ?? `<td class="tile" width="50%" style="width:50%;padding:6px;"></td>`}</tr>`);
    rows.push(`<tr><td style="padding:0 22px;" class="pxt"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs.join("")}</table></td></tr>`);
  }

  // Goals
  rows.push(sectionTitle("Progress to goal", P.gold));
  if (d.goals.length) {
    for (const g of d.goals) {
      const pct = Math.min(100, Math.round((g.actual / g.target) * 100));
      const pace = Math.min(100, Math.round((g.expectedByNow / g.target) * 100));
      rows.push(`<tr><td style="padding:4px 28px 12px 28px;" class="px">
        <div style="font-family:${SANS};font-size:14px;line-height:21px;color:${P.ink};">${esc(g.line)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
          ${pct > 0 ? `<td width="${pct}%" style="width:${pct}%;height:8px;background:${g.onTrack ? P.cobalt : P.terracotta};border-radius:8px 0 0 8px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
          ${pct < 100 ? `<td style="height:8px;background:${P.line};border-radius:${pct > 0 ? "0 8px 8px 0" : "8px"};font-size:0;line-height:0;">&nbsp;</td>` : ""}
        </tr></table>
        <div style="font-family:${SANS};font-size:11px;line-height:16px;color:${P.dim};padding-top:4px;">${pct}% done · ${pace}% of the month gone</div>
      </td></tr>`);
    }
  } else if (d.goalNote) {
    rows.push(`<tr><td style="padding:4px 28px 4px 28px;font-family:${SANS};font-size:14px;line-height:21px;color:${P.dim};" class="px">${esc(d.goalNote)}</td></tr>`);
  }

  // Insights
  if (d.insights.length) {
    rows.push(sectionTitle("What changed", P.cobalt));
    d.insights.forEach((ins, i) => {
      rows.push(`<tr><td style="padding:6px 28px 10px 28px;" class="px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="30" style="width:30px;font-family:${SERIF};font-size:26px;line-height:26px;color:${ins.tone === "good" ? P.cobalt : P.terracotta};">${i + 1}</td>
          <td valign="top" style="font-family:${SANS};">
            <div style="font-size:15px;line-height:21px;font-weight:600;color:${P.ink};">${esc(ins.title)}</div>
            <div style="font-size:14px;line-height:21px;color:${P.ink};padding-top:2px;">${esc(ins.detail)}</div>
            ${ins.why ? `<div style="font-family:${SERIF};font-style:italic;font-size:16px;line-height:22px;color:${P.dim};padding-top:4px;">Why: ${esc(ins.why)}</div>` : ""}
          </td>
        </tr></table>
      </td></tr>`);
    });
  }

  // Needs you today
  rows.push(sectionTitle("Needs you today", P.magenta));
  if (d.needs.length) {
    for (const n of d.needs) {
      rows.push(`<tr><td style="padding:6px 28px 8px 28px;" class="px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.card};border:1px solid ${P.line};border-left:3px solid ${P.magenta};border-radius:10px;"><tr><td style="padding:14px 16px;font-family:${SANS};">
          <div style="font-size:15px;line-height:21px;font-weight:600;color:${P.ink};">${esc(n.title)}${n.money > 0 ? ` <span style="font-weight:400;color:${P.dim};">· ${inr(n.money)}</span>` : ""}</div>
          <div style="font-size:13px;line-height:20px;color:${P.ink};padding-top:4px;"><span style="color:${P.dim};">Why:</span> ${esc(n.reason)}</div>
          <div style="font-size:13px;line-height:20px;color:${P.ink};"><span style="color:${P.dim};">Then:</span> ${esc(n.outcome)}</div>
          <div style="padding-top:10px;"><a href="${esc(n.href)}" style="display:inline-block;font-size:13px;line-height:18px;color:${P.paper};background:${P.ink};text-decoration:none;padding:8px 16px;border-radius:999px;">Open in admin →</a></div>
        </td></tr></table>
      </td></tr>`);
    }
  } else {
    rows.push(`<tr><td style="padding:4px 28px;font-family:${SERIF};font-style:italic;font-size:18px;line-height:26px;color:${P.dim};" class="px">Nothing is waiting on you this morning.</td></tr>`);
  }

  // Shipping
  if (d.shipping) {
    const s = d.shipping;
    rows.push(sectionTitle("Shipping health", P.bronze));
    const cells: [string, number, string][] = [
      ["Delivered", s.delivered, P.cobalt],
      ["In transit", s.inTransit + s.awaitingPickup, P.bronze],
      ["Stuck", s.stuck + s.ndr, P.magenta],
      ["RTO", s.rto, P.terracotta],
    ];
    rows.push(`<tr><td style="padding:0 22px;" class="pxt"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${cells
        .map(
          ([l, v, c]) => `<td width="25%" valign="top" style="width:25%;padding:6px;"><div style="border-top:3px solid ${c};padding-top:8px;">
            <div style="font-family:${SERIF};font-size:28px;line-height:32px;color:${P.ink};">${v}</div>
            <div style="font-family:${SANS};font-size:11px;line-height:14px;letter-spacing:1px;text-transform:uppercase;color:${P.dim};">${l}</div></div></td>`
        )
        .join("")}
    </tr></table></td></tr>
    <tr><td style="padding:6px 28px 0 28px;font-family:${SANS};font-size:12px;line-height:18px;color:${P.dim};" class="px">Orders of the last ${s.windowDays} days that have shipped.${s.awaitingPickup ? ` ${s.awaitingPickup} of those in transit are still waiting for pickup.` : ""}${s.ndr ? ` ${s.ndr} had a failed delivery attempt.` : ""}</td></tr>`);
  }

  // Stock
  if (d.stock.length) {
    rows.push(sectionTitle("Stock on top sellers", P.gold));
    rows.push(`<tr><td style="padding:0 28px;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${SANS};font-size:14px;line-height:20px;color:${P.ink};">
      ${d.stock
        .map((s) => {
          const low = s.daysOfCover !== null && s.daysOfCover < 14;
          const cover = s.stock <= 0 ? "sold out" : s.daysOfCover === null ? "—" : plural(Math.floor(s.daysOfCover), "day");
          return `<tr>
            <td style="padding:8px 0;border-bottom:1px solid ${P.line};">${esc(s.name)}<div style="font-size:12px;color:${P.dim};">${s.stock} left · ${s.unitsPerDay.toFixed(1)} a day</div></td>
            <td align="right" style="padding:8px 0;border-bottom:1px solid ${P.line};white-space:nowrap;color:${low ? P.bad : P.ink};font-weight:${low ? 600 : 400};">${cover}</td>
          </tr>`;
        })
        .join("")}
    </table>
    <div style="font-family:${SANS};font-size:12px;line-height:18px;color:${P.dim};padding-top:6px;">Days of cover at the last 14 days' pace.</div></td></tr>`);
  }

  if (d.gaps.length) {
    rows.push(`<tr><td style="padding:28px 28px 0 28px;font-family:${SANS};font-size:12px;line-height:18px;color:${P.dim};" class="px"><strong style="font-weight:600;">Not in this digest:</strong> ${esc(d.gaps.join(" "))}</td></tr>`);
  }

  const band = [P.terracotta, P.cobalt, P.magenta, P.gold, P.bronze]
    .map((c) => `<td width="20%" style="width:20%;height:6px;background:${c};font-size:0;line-height:0;">&nbsp;</td>`)
    .join("");

  const html = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${P.paper};">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(30)}</div>
<style>
  @media only screen and (max-width:620px){
    .px{padding-left:18px !important;padding-right:18px !important;}
    .pxt{padding-left:12px !important;padding-right:12px !important;}
    .h1{font-size:34px !important;line-height:36px !important;}
  }
</style>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.paper};">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${P.paper};">
  <tr>${band}</tr>
  <tr><td style="padding:28px 28px 0 28px;" class="px">
    <div style="font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${P.bronze};font-weight:700;">${esc(d.brand.name)} · Morning digest</div>
    <div class="h1" style="font-family:${DISPLAY};font-size:40px;line-height:42px;text-transform:uppercase;color:${P.ink};padding-top:8px;">${esc(d.dayLabel)}</div>
    <div style="font-family:${SERIF};font-style:italic;font-size:21px;line-height:29px;color:${P.ink};padding-top:12px;">${esc(d.headline)}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 0 28px;" class="px"><div style="height:1px;background:${P.gold};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  ${rows.join("\n")}
  <tr><td style="padding:36px 28px 0 28px;" class="px"><div style="height:1px;background:${P.gold};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:16px 28px 28px 28px;font-family:${SANS};font-size:13px;line-height:20px;color:${P.dim};" class="px">
    <a href="https://viratmohan.com/mission" style="color:${P.dim};text-decoration:none;"><span style="font-family:${SERIF};font-style:italic;font-size:17px;color:${P.ink};">Virat Mohan</span> · I build the machine that gets good products to the world. →</a>
  </td></tr>
  <tr>${band}</tr>
</table>
</td></tr>
</table>`;

  return { subject, preheader, html, text: renderDigestText(d) };
}

export function renderDigestText(d: Digest): string {
  const L: string[] = [];
  L.push(`${d.brand.name.toUpperCase()} · MORNING DIGEST · ${d.dayLabel}`, "", d.headline, "");
  if (d.scorecard.length) {
    L.push("SCORECARD");
    for (const m of d.scorecard) {
      const w = m.vsWeek ? `${arrow(m.vsWeek.dir)} ${describeDelta(m.vsWeek, m.format)} vs last ${d.weekdayName.slice(0, 3)}` : "";
      const a = m.vsAvg ? `${arrow(m.vsAvg.dir)} ${describeDelta(m.vsAvg, m.format)} vs 7-day avg` : "";
      L.push(`- ${m.label}: ${formatValue(m.value, m.format)}  ${[w, a].filter(Boolean).join(" · ")}${m.note ? ` (${m.note})` : ""}`);
    }
    L.push("");
  }
  L.push("PROGRESS TO GOAL");
  if (d.goals.length) for (const g of d.goals) L.push(`- ${g.line}`);
  else if (d.goalNote) L.push(d.goalNote);
  L.push("");
  if (d.insights.length) {
    L.push("WHAT CHANGED");
    d.insights.forEach((i, n) => L.push(`${n + 1}. ${i.title}. ${i.detail}${i.why ? ` Why: ${i.why}` : ""}`));
    L.push("");
  }
  L.push("NEEDS YOU TODAY");
  if (d.needs.length) for (const n of d.needs) L.push(`- ${n.title}${n.money ? ` (${inr(n.money)})` : ""}`, `  Why: ${n.reason}`, `  Then: ${n.outcome}`, `  ${n.href}`);
  else L.push("Nothing is waiting on you this morning.");
  L.push("");
  if (d.shipping) {
    const s = d.shipping;
    L.push(`SHIPPING (last ${s.windowDays} days)`, `Delivered ${s.delivered} · In transit ${s.inTransit + s.awaitingPickup} · Stuck ${s.stuck + s.ndr} · RTO ${s.rto}`, "");
  }
  if (d.stock.length) {
    L.push("STOCK ON TOP SELLERS (days of cover at the last 14 days' pace)");
    for (const s of d.stock) L.push(`- ${s.name}: ${s.stock} left, ${s.stock <= 0 ? "sold out" : s.daysOfCover === null ? "—" : plural(Math.floor(s.daysOfCover), "day")}`);
    L.push("");
  }
  if (d.gaps.length) L.push(`Not in this digest: ${d.gaps.join(" ")}`, "");
  L.push("—", "Virat Mohan · I build the machine that gets good products to the world.", "https://viratmohan.com/mission");
  return L.join("\n");
}
