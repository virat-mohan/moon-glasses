import test from "node:test";
import assert from "node:assert/strict";
import {
  chipCounts,
  filterOrders,
  firstName,
  itemsSummary,
  moneyLines,
  orderBucket,
  paymentPill,
  shipPill,
  sourceOf,
  timeAgo,
  type AdminOrderRow,
} from "./admin-orders.ts";

function row(over: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: "abcdef12-0000-0000-0000-000000000000",
    created_at: "2026-10-02T10:00:00Z",
    customer_name: "Asha Rao",
    customer_phone: "+91 98765 43210",
    customer_email: null,
    delivery_address: null,
    delivery_city: null,
    delivery_state: null,
    delivery_pincode: null,
    total: 1499,
    subtotal: 1499,
    discount_amount: 0,
    shipping_charge: 0,
    coupon_code_used: null,
    coupon_discount_amount: 0,
    referral_discount_amount: 0,
    loyalty_discount_amount: 0,
    payment_type: "upi_qr",
    payment_status: "paid",
    balance_due: 0,
    status: "confirmed",
    shipment_status: "not_shipped",
    refund_status: "none",
    is_gift: false,
    gift_note: null,
    shiprocket_order_id: null,
    shiprocket_shipment_id: null,
    shiprocket_awb_code: null,
    shiprocket_label_url: null,
    courier_name: null,
    razorpay_payment_id: null,
    refunded_amount: 0,
    return_shipment_id: null,
    is_post_barter: false,
    barter_tier: null,
    barter_coupon_code: null,
    barter_required_orders: null,
    barter_qualified_at: null,
    is_test: false,
    upi_utr: null,
    order_source: null,
    delivered_at: null,
    items: [],
    ...over,
  };
}

test("buckets: every order lands in exactly one", () => {
  assert.equal(orderBucket(row()), "to_ship");
  assert.equal(orderBucket(row({ payment_status: "unpaid" })), "waiting");
  assert.equal(orderBucket(row({ shipment_status: "In Transit" })), "shipped");
  assert.equal(orderBucket(row({ shipment_status: "Delivered" })), "delivered");
  assert.equal(orderBucket(row({ status: "cancelled", payment_status: "unpaid" })), "cancelled");
  assert.equal(orderBucket(row({ shipment_status: "RTO Initiated" })), "returns");
  assert.equal(orderBucket(row({ refund_status: "requested" })), "returns");
  assert.equal(orderBucket(row({ is_post_barter: true, barter_tier: "sell_first", payment_type: "prepaid" })), "waiting");
});

test("chipCounts adds up to All", () => {
  const rows = [
    row(),
    row({ payment_status: "unpaid" }),
    row({ shipment_status: "In Transit" }),
    row({ status: "cancelled" }),
  ];
  const c = chipCounts(rows);
  assert.equal(c.all, 4);
  assert.equal(c.to_ship + c.waiting + c.shipped + c.delivered + c.cancelled + c.returns, 4);
  assert.equal(c.waiting, 1);
  assert.equal(c.cancelled, 1);
});

test("free code order shows Free pill and zero total", () => {
  const free = row({ total: 0, coupon_code_used: "VM100", coupon_discount_amount: 1999, subtotal: 1999 });
  assert.equal(paymentPill(free).label, "Free");
  const lines = moneyLines(free);
  assert.ok(lines.some((l) => l.label === "Code VM100" && l.amount === "−₹1,999"));
  assert.equal(lines.find((l) => l.strong)?.amount, "₹0");
  assert.equal(lines.find((l) => l.label === "Shipping")?.amount, "Free");
});

test("payment and shipping pills in plain words", () => {
  assert.equal(paymentPill(row({ payment_status: "unpaid" })).label, "Waiting for payment");
  assert.equal(paymentPill(row({ is_post_barter: true })).label, "Pay With A Post");
  assert.equal(shipPill(row()).label, "Not shipped yet");
  assert.equal(shipPill(row({ shipment_status: "processing" })).label, "Waiting for pickup");
  assert.equal(shipPill(row({ shipment_status: "Out For Delivery" })).label, "Out for delivery");
});

test("source, names, items summary, time", () => {
  assert.equal(sourceOf(row()), "Website");
  assert.equal(sourceOf(row({ order_source: "whatsapp" })), "WhatsApp");
  assert.equal(sourceOf(row({ is_post_barter: true })), "Pay With A Post");
  assert.equal(firstName("  Asha Rao "), "Asha");
  assert.equal(
    itemsSummary([
      { slug: "a", name: "Eclipse — Black", qty: 2, unitPrice: 1, warehouseLine: null },
      { slug: "b", name: "Voltage", qty: 1, unitPrice: 1, warehouseLine: null },
    ]),
    "3 items · Eclipse — Black +1 more"
  );
  const now = new Date("2026-10-02T12:00:00Z").getTime();
  assert.equal(timeAgo("2026-10-02T11:30:00Z", now), "30m ago");
  assert.equal(timeAgo("2026-10-02T09:00:00Z", now), "3h ago");
  assert.equal(timeAgo("2026-09-30T12:00:00Z", now), "2d ago");
});

test("filterOrders: search by name, phone, id and date range", () => {
  const rows = [row(), row({ id: "99999999-0", customer_name: "Ben", customer_phone: "9000011111", created_at: "2026-09-01T10:00:00Z" })];
  assert.equal(filterOrders(rows, { filter: "all", query: "asha" }).length, 1);
  assert.equal(filterOrders(rows, { filter: "all", query: "90000" }).length, 1);
  assert.equal(filterOrders(rows, { filter: "all", query: "#ABCDEF12" }).length, 1);
  assert.equal(filterOrders(rows, { filter: "all", query: "", from: "2026-10-01" }).length, 1);
  assert.equal(filterOrders(rows, { filter: "waiting", query: "" }).length, 0);
});
