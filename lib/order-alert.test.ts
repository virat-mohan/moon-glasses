import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderAlertParams,
  orderAlertStatusText,
  alreadyAlerted,
  orderAlertLogName,
  normalizeAlertNumber,
  ORDER_ALERT_WHATSAPP_DEFAULT,
} from "./order-alert.ts";

const order = { id: "ab12cd34-5678-90ef-aaaa-bbbbccccdddd", total: 2998, payment_type: "upi_qr" };

test("builds the five template params in order", () => {
  assert.deepEqual(buildOrderAlertParams(order, 2, "created"), [
    "#AB12CD34",
    "2",
    "2,998",
    "UPI pending",
    "https://www.moon-glasses.store/admin/orders",
  ]);
});

test("status text per event and order type", () => {
  assert.equal(orderAlertStatusText("upi_qr", "created"), "UPI pending");
  assert.equal(orderAlertStatusText("upi_qr", "paid"), "UPI paid");
  assert.equal(orderAlertStatusText("post_barter", "created"), "Pay With A Post");
});

test("no customer PII in params", () => {
  const withPii = { ...order, customer_name: "Anun Shah", customer_phone: "9876543210", address: "12 MG Road" };
  const joined = buildOrderAlertParams(withPii, 1, "paid").join(" ");
  for (const pii of ["Anun", "9876543210", "MG Road"]) assert.ok(!joined.includes(pii));
});

test("dedupe per order + event", () => {
  const rows = [{ order_id: order.id, template_name: orderAlertLogName("created") }];
  assert.equal(alreadyAlerted(rows, order.id, "created"), true);
  assert.equal(alreadyAlerted(rows, order.id, "paid"), false);
  assert.equal(alreadyAlerted(rows, "other", "created"), false);
  assert.equal(alreadyAlerted([], order.id, "created"), false);
});

test("alert number falls back to default", () => {
  assert.equal(normalizeAlertNumber(null), ORDER_ALERT_WHATSAPP_DEFAULT);
  assert.equal(normalizeAlertNumber("+91 98765 43210"), "919876543210");
});
