/**
 * Test orders (orders.is_test): placed by someone with a valid admin session
 * to walk the whole customer journey on phone or web. Nothing real-world
 * happens for them: no shipping, no stock, no Meta, no alerts, no counters.
 * The customer-facing journey (confirmation page, QR, customer email and
 * WhatsApp, PWAP share page/code) is kept so the tester sees what a shopper sees.
 *
 * Pure module (no imports) so node --test can load it directly.
 */

export type MaybeTestOrder = { is_test?: boolean | null } | null | undefined;

export function isTestOrder(order: MaybeTestOrder): boolean {
  return order?.is_test === true;
}

/**
 * The testOrder flag from the browser is only honoured when the server has
 * already verified an admin session (role non-null). Never trust the flag alone.
 */
export function resolveTestOrderFlag(requested: unknown, adminRole: string | null | undefined): boolean {
  return requested === true && !!adminRole;
}

export type SideEffect =
  // skipped for test orders
  | "shiprocket"
  | "warehouse_email"
  | "warehouse_whatsapp"
  | "stock_decrement"
  | "low_stock_alert"
  | "meta_purchase"
  | "first_party_purchase"
  | "order_alert_whatsapp"
  | "customer_issue_alert"
  | "coupon_redemption"
  | "discount_rule_redemption"
  | "pwap_sales_count"
  | "loyalty_points"
  | "referral_reward"
  | "guest_lead"
  | "newsletter_optin"
  | "review_winback_abandon"
  | "bank_match"
  | "reporting"
  // kept for test orders
  | "customer_confirmation_email"
  | "customer_confirmation_whatsapp"
  | "team_order_email"
  | "pwap_share_card"
  | "cart_session_converted";

export type Decision = "run" | "skip" | "prefix";

/** What happens to each side effect on a test order. Real orders: everything runs. */
export const TEST_ORDER_DECISIONS: Record<SideEffect, Decision> = {
  shiprocket: "skip",
  warehouse_email: "skip",
  warehouse_whatsapp: "skip",
  stock_decrement: "skip",
  low_stock_alert: "skip",
  meta_purchase: "skip",
  first_party_purchase: "skip",
  order_alert_whatsapp: "skip",
  customer_issue_alert: "skip",
  coupon_redemption: "skip",
  discount_rule_redemption: "skip",
  pwap_sales_count: "skip",
  loyalty_points: "skip",
  referral_reward: "skip",
  guest_lead: "skip",
  newsletter_optin: "skip",
  review_winback_abandon: "skip",
  bank_match: "skip",
  reporting: "skip",
  customer_confirmation_email: "prefix",
  customer_confirmation_whatsapp: "run",
  team_order_email: "prefix",
  pwap_share_card: "run",
  cart_session_converted: "run",
};

export function sideEffectDecision(effect: SideEffect, order: MaybeTestOrder): Decision {
  return isTestOrder(order) ? TEST_ORDER_DECISIONS[effect] : "run";
}

/** True when the side effect should happen at all (run or prefix). */
export function shouldRun(effect: SideEffect, order: MaybeTestOrder): boolean {
  return sideEffectDecision(effect, order) !== "skip";
}

export const TEST_SUBJECT_PREFIX = "[TEST] ";

export function testSubject(subject: string, order: MaybeTestOrder): string {
  return isTestOrder(order) && !subject.startsWith(TEST_SUBJECT_PREFIX) ? TEST_SUBJECT_PREFIX + subject : subject;
}
