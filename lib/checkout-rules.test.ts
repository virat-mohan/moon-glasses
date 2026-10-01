// Founder checkout decisions (2 Oct 2026): UPI only, no COD, quantity 1–50,
// one discount per order, ₹1 floor, free shipping, Pay With A Post stock
// floor, and one Meta Purchase event_id per order.
//   node --experimental-strip-types --test lib/checkout-rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPwapStock,
  assertStorefrontPaymentAllowed,
  assertValidOrderQuantities,
  clampLineQuantity,
  buildStockShortAlert,
  computeOrderTotal,
  computeTotalWithCoupon,
  isFreePairCouponCode,
  hasStockFor,
  isPwapAvailableForStock,
  pickBestDiscount,
  pixelTrackArgs,
  priceItemsFromCatalog,
  purchaseEventId,
  shippingChargeFor,
  COD_DISABLED_MESSAGE,
  RAZORPAY_DISABLED_MESSAGE,
  PWAP_MIN_STOCK,
} from "./checkout-rules.ts";

const catalog = [
  { slug: "tangerine", name: "Tangerine", price: 1999 },
  { slug: "dusk", name: "Dusk", price: 2499 },
];

test("tampered client price is ignored: lines are priced from the catalogue", () => {
  const tampered = [{ slug: "tangerine", quantity: 2, price: 1, name: "Free" }];
  const priced = priceItemsFromCatalog(tampered, catalog);
  assert.deepEqual(priced, [{ slug: "tangerine", name: "Tangerine", price: 1999, quantity: 2 }]);
  assert.throws(() => priceItemsFromCatalog([{ slug: "nope", quantity: 1 }], catalog), /Unknown chapter/);
});

test("quantity 0, 51, -1 and 1.5 are rejected; 1 and 50 are allowed", () => {
  for (const quantity of [0, 51, -1, 1.5, Number.NaN, "2" as unknown as number]) {
    assert.throws(() => assertValidOrderQuantities([{ slug: "tangerine", quantity }]), /whole number from 1 to 50/);
    assert.throws(() => priceItemsFromCatalog([{ slug: "tangerine", quantity }], catalog));
  }
  assert.doesNotThrow(() => assertValidOrderQuantities([{ slug: "tangerine", quantity: 1 }, { slug: "dusk", quantity: 50 }]));
  assert.throws(() => assertValidOrderQuantities([]), /empty/);
});

test("cart UI clamps quantity into 1..50", () => {
  assert.equal(clampLineQuantity(51), 50);
  assert.equal(clampLineQuantity(0), 1);
  assert.equal(clampLineQuantity(2.7), 2);
});

test("stacked discounts: only the single largest applies, others are reported dropped", () => {
  const best = pickBestDiscount({ miles: 100, referral: 250, coupon: 200 });
  assert.equal(best.applied, "referral");
  assert.equal(best.amount, 250);
  assert.deepEqual(best.dropped, ["miles", "coupon"]);

  assert.deepEqual(pickBestDiscount({ coupon: 300 }), { applied: "coupon", amount: 300, dropped: [] });
  assert.deepEqual(pickBestDiscount({}), { applied: null, amount: 0, dropped: [] });
  // The total uses one discount, never the sum.
  assert.equal(computeOrderTotal(2000, 0, best.amount), 1750);
});

test("total never goes below ₹1", () => {
  assert.equal(computeOrderTotal(1999, 0, 5000), 1);
  assert.equal(computeOrderTotal(1999, 1999, 0), 1);
});

test("shipping is always free", () => {
  assert.equal(shippingChargeFor(), 0);
});

test("Razorpay and COD are rejected; UPI and Pay With A Post are allowed", () => {
  assert.throws(() => assertStorefrontPaymentAllowed("cod_advance"), { message: COD_DISABLED_MESSAGE });
  assert.throws(() => assertStorefrontPaymentAllowed("razorpay"), { message: RAZORPAY_DISABLED_MESSAGE });
  assert.equal(RAZORPAY_DISABLED_MESSAGE, "Card payments are not available. Please pay by UPI.");
  assert.doesNotThrow(() => assertStorefrontPaymentAllowed("upi_qr"));
  assert.doesNotThrow(() => assertStorefrontPaymentAllowed("post_barter"));
  assert.doesNotThrow(() => assertStorefrontPaymentAllowed(undefined));
});

test("Pay With A Post is rejected at stock 24 and allowed at 25", () => {
  assert.equal(PWAP_MIN_STOCK, 25);
  assert.equal(isPwapAvailableForStock(24), false);
  assert.equal(isPwapAvailableForStock(25), true);
  assert.equal(isPwapAvailableForStock(undefined), false);
  assert.throws(() => assertPwapStock([{ slug: "tangerine" }], { tangerine: 24 }), /isn't available/);
  assert.doesNotThrow(() => assertPwapStock([{ slug: "tangerine" }], { tangerine: 25 }));
});

test("stock check refuses a sale when short", () => {
  assert.equal(hasStockFor(2, 3), false);
  assert.equal(hasStockFor(3, 3), true);
});

test("one Purchase event_id, equal to the order id, on pixel and server", () => {
  const orderId = "2f0c6c1e-6a52-4c39-9f2e-6a8f0b7c1d11";
  assert.equal(purchaseEventId(orderId), orderId);
  const args = pixelTrackArgs("Purchase", { value: 1999, orderId });
  assert.deepEqual(args, ["track", "Purchase", { value: 1999, currency: "INR" }, { eventID: orderId }]);
  assert.throws(() => pixelTrackArgs("Purchase", { value: 1999 }), /order id/);
  assert.deepEqual(pixelTrackArgs("AddToCart", { value: 10 }), ["track", "AddToCart", { value: 10, currency: "INR" }]);
});

test("a Pay With A Post free-pair coupon makes the order ₹0; a normal coupon floors at ₹1", () => {
  assert.equal(isFreePairCouponCode("FREEPRIYA1K3"), true);
  assert.equal(isFreePairCouponCode("BUYNOW10"), false);
  const covering = { applied: "coupon" as const, amount: 1999 };
  assert.equal(computeTotalWithCoupon(1999, 0, covering, "FREEPRIYA1K3"), 0);
  assert.equal(computeTotalWithCoupon(1999, 0, covering, "BIGSALE"), 1);
  // A free-pair code that doesn't cover the whole order is an ordinary discount.
  assert.equal(computeTotalWithCoupon(4498, 0, covering, "FREEPRIYA1K3"), 2499);
  // Miles or referral never get the ₹0 exemption.
  assert.equal(computeTotalWithCoupon(1999, 0, { applied: "miles", amount: 1999 }, "FREEPRIYA1K3"), 1);
});

test("stock-short alert names the order, customer, amount paid and says refund needed", () => {
  const { subject, text } = buildStockShortAlert({
    id: "2f0c6c1e-6a52-4c39-9f2e-6a8f0b7c1d11",
    customer_name: "Asha",
    customer_phone: "919000000000",
    customer_email: "asha@example.com",
    total: 1999,
  });
  assert.match(subject, /Refund needed/);
  assert.match(text, /Refund needed/);
  assert.match(text, /2f0c6c1e-6a52-4c39-9f2e-6a8f0b7c1d11/);
  assert.match(text, /Asha, 919000000000, asha@example.com/);
  assert.match(text, /Amount paid: ₹1,999/);
});
