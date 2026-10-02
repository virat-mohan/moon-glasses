import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTestOrder,
  resolveTestOrderFlag,
  shouldRun,
  sideEffectDecision,
  testSubject,
  TEST_ORDER_DECISIONS,
  type SideEffect,
} from "./test-order.ts";

test("isTestOrder: only an explicit true", () => {
  assert.equal(isTestOrder({ is_test: true }), true);
  assert.equal(isTestOrder({ is_test: false }), false);
  assert.equal(isTestOrder({ is_test: null }), false);
  assert.equal(isTestOrder({}), false);
  assert.equal(isTestOrder(null), false);
  assert.equal(isTestOrder(undefined), false);
});

test("testOrder flag is ignored without an admin session", () => {
  assert.equal(resolveTestOrderFlag(true, null), false);
  assert.equal(resolveTestOrderFlag(true, undefined), false);
  assert.equal(resolveTestOrderFlag(true, ""), false);
  assert.equal(resolveTestOrderFlag("true", "owner"), false);
  assert.equal(resolveTestOrderFlag(1, "owner"), false);
  assert.equal(resolveTestOrderFlag(false, "owner"), false);
  assert.equal(resolveTestOrderFlag(true, "owner"), true);
  assert.equal(resolveTestOrderFlag(true, "team"), true);
});

const SKIPPED: SideEffect[] = [
  "shiprocket", "warehouse_email", "warehouse_whatsapp", "stock_decrement", "low_stock_alert",
  "meta_purchase", "first_party_purchase", "order_alert_whatsapp", "customer_issue_alert",
  "coupon_redemption", "discount_rule_redemption", "pwap_sales_count", "loyalty_points",
  "referral_reward", "guest_lead", "newsletter_optin", "review_winback_abandon", "bank_match", "reporting",
];
const KEPT: SideEffect[] = ["customer_confirmation_whatsapp", "pwap_share_card", "cart_session_converted"];
const PREFIXED: SideEffect[] = ["customer_confirmation_email", "team_order_email"];

test("side-effect decision table for a test order", () => {
  const t = { is_test: true };
  for (const e of SKIPPED) { assert.equal(sideEffectDecision(e, t), "skip", e); assert.equal(shouldRun(e, t), false, e); }
  for (const e of KEPT) { assert.equal(sideEffectDecision(e, t), "run", e); assert.equal(shouldRun(e, t), true, e); }
  for (const e of PREFIXED) { assert.equal(sideEffectDecision(e, t), "prefix", e); assert.equal(shouldRun(e, t), true, e); }
  assert.equal(SKIPPED.length + KEPT.length + PREFIXED.length, Object.keys(TEST_ORDER_DECISIONS).length);
});

test("real orders run every side effect", () => {
  for (const e of Object.keys(TEST_ORDER_DECISIONS) as SideEffect[]) {
    assert.equal(sideEffectDecision(e, { is_test: false }), "run", e);
    assert.equal(shouldRun(e, null), true, e);
  }
});

test("[TEST] subject prefix only on test orders, never doubled", () => {
  assert.equal(testSubject("New order confirmed — #AB", { is_test: true }), "[TEST] New order confirmed — #AB");
  assert.equal(testSubject("[TEST] x", { is_test: true }), "[TEST] x");
  assert.equal(testSubject("New order confirmed — #AB", { is_test: false }), "New order confirmed — #AB");
});
