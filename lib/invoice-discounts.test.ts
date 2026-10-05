// Invoice discount lines (money document: every discount the order recorded must show).
//   node --experimental-strip-types --test lib/invoice-discounts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceDiscountLines, orderEarnsGoodVibes } from "./invoice-discounts.ts";

test("a coupon code shows with its code and amount (numeric string from the DB)", () => {
  assert.deepEqual(
    invoiceDiscountLines({ discount_amount: 0, coupon_code_used: "FAMILY20", coupon_discount_amount: "400" }),
    [{ label: "Discount code FAMILY20", amount: 400 }]
  );
});

test("a 100% code shows the full amount", () => {
  assert.deepEqual(
    invoiceDiscountLines({ discount_amount: 0, coupon_code_used: "VM100", coupon_discount_amount: "1999" }),
    [{ label: "Discount code VM100", amount: 1999 }]
  );
});

test("each recorded discount kind gets its own line, in a stable order", () => {
  const lines = invoiceDiscountLines({
    discount_amount: 100,
    coupon_code_used: "ABC",
    coupon_discount_amount: 200,
    referral_discount_amount: 300,
    loyalty_discount_amount: 50,
  });
  assert.deepEqual(lines.map((l) => l.label), ["Offer discount", "Discount code ABC", "Referral code", "Good Vibes redeemed"]);
  assert.equal(lines.reduce((s, l) => s + l.amount, 0), 650);
});

test("no discount, zero, null, negative and junk values print nothing", () => {
  assert.deepEqual(invoiceDiscountLines({}), []);
  assert.deepEqual(invoiceDiscountLines({ discount_amount: 0, coupon_discount_amount: "0", referral_discount_amount: null }), []);
  assert.deepEqual(invoiceDiscountLines({ coupon_discount_amount: -50, loyalty_discount_amount: "abc" }), []);
});

test("a code with markup can never reach the invoice HTML", () => {
  const [line] = invoiceDiscountLines({ coupon_code_used: '<img src=x onerror=alert(1)>FAM"20', coupon_discount_amount: 100 });
  assert.ok(!/[<>"]/.test(line.label));
});

test("a coupon amount with no code still shows a labelled line", () => {
  assert.deepEqual(invoiceDiscountLines({ coupon_discount_amount: 150 }), [{ label: "Discount code", amount: 150 }]);
});

test("Good Vibes are promised only on orders paid with money", () => {
  assert.equal(orderEarnsGoodVibes({ total: 1599 }), true);
  assert.equal(orderEarnsGoodVibes({ total: "1599", is_post_barter: false }), true);
  assert.equal(orderEarnsGoodVibes({ total: 0 }), false); // 100% code
  assert.equal(orderEarnsGoodVibes({ total: 1499, is_post_barter: true }), false); // Pay With A Post
});
