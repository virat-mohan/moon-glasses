// Run with: npm test   (node's built-in runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDigest, computeNeeds, delta, describeDelta, rankInsights, renderDigestEmail, type DigestInput, type Insight, type RawOrder } from "./ops-digest-core.ts";

const NOW = new Date("2026-09-26T03:00:00Z"); // 08:30 IST, Saturday
const brand = { name: "Test", siteUrl: "https://example.test" };

function order(id: string, createdAt: string, total: number, extra: Partial<RawOrder> = {}): RawOrder {
  return {
    id,
    created_at: createdAt,
    total,
    status: "confirmed",
    payment_status: "paid",
    payment_type: "prepaid",
    shipment_status: "delivered",
    shiprocket_awb_code: "AWB",
    delivery_pincode: "560001",
    delivery_city: "Bengaluru",
    delivered_at: null,
    rto_processed_at: null,
    ...extra,
  };
}
function input(p: Partial<DigestInput> = {}): DigestInput {
  return { now: NOW, brand, orders: [], items: [], events: [], returns: [], inventory: [], lowStockThreshold: 5, sessionsByDay: null, adSpendByDay: null, target: null, ...p };
}

test("delta: direction, percentage and the zero base", () => {
  assert.deepEqual(delta(150, 100), { abs: 50, pct: 0.5, dir: "up" });
  assert.equal(delta(50, 100).dir, "down");
  assert.equal(delta(101, 100).dir, "flat"); // within 2%
  assert.equal(delta(5, 0).pct, null);
  assert.equal(delta(5, 0).dir, "up");
  assert.equal(describeDelta(delta(150, 100), "inr"), "+50%");
  assert.equal(describeDelta(delta(0.03, 0.02, 0), "pct"), "+1.0 pts");
  assert.equal(describeDelta(delta(500, 0), "inr"), "+₹500");
});

test("rankInsights: biggest money first, drops zero-impact, keeps three", () => {
  const mk = (title: string, impact: number): Insight => ({ title, detail: "", why: null, impact, tone: "good" });
  const ranked = rankInsights([mk("a", 100), mk("b", 0), mk("c", 5000), mk("d", 900), mk("e", 2500), mk("f", NaN)]);
  assert.deepEqual(ranked.map((i) => i.title), ["c", "e", "d"]);
});

test("needs: unshipped over 48h only, ranked by money", () => {
  const needs = computeNeeds(
    {
      now: NOW,
      brand,
      lowStockThreshold: 5,
      events: [],
      returns: [{ id: "r1", order_id: "big", status: "requested", created_at: "2026-09-25T10:00:00Z" }],
      orders: [
        order("old", "2026-09-23T10:00:00Z", 1200, { shipment_status: "not_shipped" }), // ~65h
        order("new", "2026-09-25T10:00:00Z", 900, { shipment_status: "not_shipped" }), // ~17h: not yet
        order("unpaid", "2026-09-23T10:00:00Z", 700, { shipment_status: "not_shipped", payment_status: "unpaid" }),
        order("big", "2026-09-20T10:00:00Z", 5000),
      ],
    },
    []
  );
  const unshipped = needs.find((n) => n.key === "unshipped");
  assert.equal(unshipped?.count, 1);
  assert.equal(unshipped?.money, 1200);
  assert.equal(needs.find((n) => n.key === "unpaid")?.count, 1);
  assert.equal(needs[0].key, "returns_requested"); // ₹5,000 at stake beats ₹1,200
  assert.ok(needs.every((n) => n.href.startsWith("https://example.test/admin/")));
});

test("needs: AWB with no scan, failed refund without a later refund, and low cover", () => {
  const needs = computeNeeds(
    {
      now: NOW,
      brand,
      lowStockThreshold: 0,
      returns: [],
      orders: [order("a", "2026-09-22T10:00:00Z", 999, { shipment_status: "pickup_pending" }), order("b", "2026-09-10T10:00:00Z", 800)],
      events: [
        { order_id: "b", event_type: "rto_refund_failed", created_at: "2026-09-20T10:00:00Z" },
        { order_id: "a", event_type: "return_refund_failed", created_at: "2026-09-20T10:00:00Z" },
        { order_id: "a", event_type: "return_refunded", created_at: "2026-09-21T10:00:00Z" },
      ],
    },
    [{ name: "Aviator", stock: 4, unitsPerDay: 1, daysOfCover: 4, unitPrice: 1000 }]
  );
  assert.equal(needs.find((n) => n.key === "no_scan")?.count, 1);
  assert.equal(needs.find((n) => n.key === "refund_failed")?.count, 1);
  const low = needs.find((n) => n.key === "low_stock");
  assert.equal(low?.money, 10000); // 10 days short × 1/day × ₹1,000
});

test("buildDigest: honest headline and sections left out when there is no data", () => {
  const empty = buildDigest(input());
  assert.match(empty.headline, /No orders/);
  assert.equal(empty.scorecard.length, 0);
  assert.equal(empty.shipping, null);
  assert.equal(empty.goals.length, 0);
  assert.ok(empty.goalNote?.includes("/admin/business-plan"));
  assert.ok(empty.gaps.some((g) => /analytics/.test(g)));
  assert.ok(empty.gaps.some((g) => /Meta/.test(g)));

  const d = buildDigest(
    input({
      orders: [order("y1", "2026-09-25T06:00:00Z", 3000), order("y2", "2026-09-25T08:00:00Z", 1000), order("w1", "2026-09-18T06:00:00Z", 2000)],
      target: { revenue: 100000, orders: null, source: "test" },
    })
  );
  assert.equal(d.day, "2026-09-25");
  const rev = d.scorecard.find((m) => m.key === "revenue");
  assert.equal(rev?.value, 4000);
  assert.equal(rev?.vsWeek?.pct, 1);
  assert.match(d.headline, /₹4,000 from 2 orders: \+100% on last Friday/);
  assert.equal(d.goals[0].actual, 6000); // Sept 18 + Sept 25
  assert.equal(d.goals[0].onTrack, false);
  assert.ok(!d.scorecard.some((m) => m.key === "conversion" || m.key === "roas"));

  const email = renderDigestEmail(d);
  assert.ok(email.html.includes(d.headline.replace(/&/g, "&amp;")));
  assert.ok(email.text.includes("https://viratmohan.com/mission"));
});
