import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsAppOrder, validateWaCart, shouldReplyToOrder, syntheticOrderMessageId, buildOrderReply, buildPayReply, buildAskAgainReply, buildFallbackReply, looksLikeOrderPayload } from "./wa-order.ts";
import { signCartToken, verifyCartToken, CART_TOKEN_TTL_MS } from "./cart-token.ts";
import { parseAddressMessage } from "./wa-address.ts";
import { startSession, onAddressFailure, isSessionActive, phoneKey, WA_SESSION_TTL_MS } from "./wa-session.ts";
import { buildUpiLink, upiPayButtons } from "./upi-links.ts";
import { checkVoice, hasBlock } from "./brand-voice.ts";

const order = { catalog_id: "c1", text: "hi", product_items: [{ product_retailer_id: "voltage-aviator-gold-pink", quantity: 2, item_price: 1, currency: "INR" }] };
const cloud = { object: "whatsapp_business_account", entry: [{ changes: [{ value: { contacts: [{ profile: { name: "Aarav" }, wa_id: "919876543210" }], messages: [{ from: "919876543210", id: "wamid.A1", type: "order", order }] } }] }] };
const msg91 = { customerNumber: "919876543210", customerName: "Aarav", messages: [{ from: "919876543210", id: "wamid.B2", type: "order", order }] };
const stringified = { customerNumber: "919876543210", messages: JSON.stringify([{ from: "919876543210", id: "wamid.C3", type: "order", order: JSON.stringify(order) }]) };

test("parser: plain Cloud API", () => {
  const p = parseWhatsAppOrder(cloud)!;
  assert.equal(p.phone, "919876543210");
  assert.equal(p.messageId, "wamid.A1");
  assert.equal(p.name, "Aarav");
  assert.deepEqual(p.items, [{ retailerId: "voltage-aviator-gold-pink", qty: 2 }]);
});
test("parser: MSG91 wrapped", () => {
  const p = parseWhatsAppOrder(msg91)!;
  assert.equal(p.phone, "919876543210");
  assert.equal(p.name, "Aarav");
  assert.equal(p.messageId, "wamid.B2");
  assert.equal(p.items.length, 1);
});
test("parser: stringified JSON inside JSON", () => {
  const p = parseWhatsAppOrder(stringified)!;
  assert.equal(p.messageId, "wamid.C3");
  assert.equal(p.items[0].qty, 2);
});
test("parser: no order -> null; order-looking junk flagged for raw logging", () => {
  assert.equal(parseWhatsAppOrder({ messages: [{ from: "1", text: { body: "hi" } }] }), null);
  assert.equal(looksLikeOrderPayload({ type: "order", weird: true }), true);
  assert.equal(looksLikeOrderPayload({ text: "hello" }), false);
});

const cat = [
  { slug: "a", name: "Voltage Aviator — Gold Pink", price: 2499 },
  { slug: "b", name: "Eclipse Round — Black", price: 1499 },
];
const v = (items: { retailerId: string; qty: number }[], stock: Record<string, number> = {}) => validateWaCart(items, cat, stock, ["a", "b", "draft"]);

test("validation: quantity bounds and integers", () => {
  for (const q of [0, 51, -1, 1.5, NaN]) {
    const r = v([{ retailerId: "a", qty: q }]);
    assert.equal(r.lines.length, 0, `qty ${q}`);
    assert.equal(r.dropped[0].reason, "bad-quantity");
  }
  assert.equal(v([{ retailerId: "a", qty: 50 }]).lines[0].qty, 50);
});
test("validation: duplicates merge, total from catalogue", () => {
  const r = v([{ retailerId: "a", qty: 1 }, { retailerId: "a", qty: 2 }, { retailerId: "b", qty: 1 }]);
  assert.deepEqual(r.lines.map((l) => [l.slug, l.qty]), [["a", 3], ["b", 1]]);
  assert.equal(r.total, 2499 * 3 + 1499);
});
test("validation: unknown, not-live, out of stock, short stock", () => {
  const r = v([{ retailerId: "zzz", qty: 1 }, { retailerId: "draft", qty: 1 }, { retailerId: "a", qty: 1 }, { retailerId: "b", qty: 3 }], { a: 0, b: 2 });
  assert.deepEqual(r.dropped.map((d) => d.reason), ["unknown", "not-live", "out-of-stock", "not-enough-stock"]);
  assert.equal(r.lines.length, 0);
});
test("validation: tampered price in the message is ignored", () => {
  const p = parseWhatsAppOrder({ ...order, product_items: [{ product_retailer_id: "a", quantity: 1, item_price: 1, currency: "INR" }] })!;
  assert.equal(JSON.stringify(p).includes("item_price"), false);
  assert.equal(v(p.items).total, 2499);
});

test("token: sign, verify, expiry, tamper, no PII", () => {
  const secret = "test-secret";
  const t = signCartToken([{ s: "a", q: 2 }], { secret, now: 1_000_000 });
  assert.deepEqual(verifyCartToken(t, { secret, now: 1_000_000 + 1000 }), { ok: true, lines: [{ s: "a", q: 2 }] });
  assert.equal((verifyCartToken(t, { secret, now: 1_000_000 + CART_TOKEN_TTL_MS + 5000 }) as { reason: string }).reason, "expired");
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ i: [{ s: "a", q: 50 }], e: 9e9 })).toString("base64url");
  assert.equal(verifyCartToken(`${forged}.${sig}`, { secret }).ok, false);
  assert.equal(verifyCartToken(`${body}.AAAA`, { secret }).ok, false);
  assert.equal(verifyCartToken(t, { secret: "other" }).ok, false);
  assert.equal(verifyCartToken("junk", { secret }).ok, false);
  assert.ok(!Buffer.from(body, "base64url").toString().match(/phone|name|91\d{8}/));
});

test("dedupe decision", () => {
  assert.equal(shouldReplyToOrder({ messageId: "w1", alreadySeen: false }), true);
  assert.equal(shouldReplyToOrder({ messageId: "w1", alreadySeen: true }), false);
  const a = syntheticOrderMessageId("919876543210", [{ retailerId: "a", qty: 1 }, { retailerId: "b", qty: 2 }], 1_000_000);
  assert.equal(a, syntheticOrderMessageId("+91 98765 43210", [{ retailerId: "b", qty: 2 }, { retailerId: "a", qty: 1 }], 1_000_100));
});

test("reply copy passes brand voice and carries total/link", () => {
  const cart = v([{ retailerId: "a", qty: 1 }, { retailerId: "zzz", qty: 1 }]);
  const directLinkReply = buildOrderReply(cart, "https://www.moon-glasses.store/cart/whatsapp?c=x");
  const offerReply = buildOrderReply(cart, "https://www.moon-glasses.store/cart?items=a:1", { discount: 1499, ruleName: "Buy 3 Get 1 Free" });
  const texts = [
    buildOrderReply(cart),
    directLinkReply,
    offerReply,
    buildPayReply({ cart, name: "Aarav", address: "12 Park Street, Salt Lake", pincode: "700091", payLink: "https://www.moon-glasses.store/pay/abc" }),
    buildAskAgainReply("Aarav\n12 Park Street\nKolkata 700091"),
    buildFallbackReply("https://www.moon-glasses.store/cart/whatsapp?c=x"),
  ];
  for (const t of texts) assert.equal(hasBlock(checkVoice(t, "whatsapp")), false, t);
  assert.ok(texts[0].includes("₹2,499") && texts[0].includes("name, full address and pincode in one message (email optional)"));
  assert.ok(directLinkReply.includes("https://www.moon-glasses.store/cart/whatsapp?c=x"));
  assert.ok(!directLinkReply.includes("Your items are already added to your cart with free express delivery"));
  assert.ok(offerReply.includes("Buy 3 Get 1 Free, −₹1,499"));
  assert.ok(texts[3].includes("https://www.moon-glasses.store/pay/abc") && texts[3].includes("wrong address? reply here before it ships."));
});

test("address parsing", () => {
  const good = parseAddressMessage("Aarav Mehta\n12 Park Street, Flat 4B\nKolkata 700091\naarav@x.in");
  assert.deepEqual(good, { ok: true, name: "Aarav Mehta", address: "12 Park Street, Flat 4B, Kolkata", pincode: "700091", email: "aarav@x.in" });
  assert.equal((parseAddressMessage("Aarav\n12 Park Street Kolkata") as { reason: string }).reason, "no-pincode");
  assert.equal((parseAddressMessage("Aarav\n12 Park Street 700091 and 110001") as { reason: string }).reason, "multiple-pincodes");
  assert.equal((parseAddressMessage("Aarav Mehta") as { reason: string }).reason, "no-pincode");
  assert.equal((parseAddressMessage("Aarav Mehta 700091") as { reason: string }).reason, "short-address");
  const one = parseAddressMessage("Riya Shah, B-12 Green Park, Delhi 110016", "Whatsapp Name");
  assert.ok(one.ok && one.name === "Riya Shah" && one.pincode === "110016" && one.email === null);
  const hing = parseAddressMessage("mera naam Karan hai\nghar 14 Gandhi Nagar, Jaipur\npincode 302015", "Kay");
  assert.ok(hing.ok && hing.name === "Karan" && hing.address.includes("Gandhi Nagar") && hing.pincode === "302015");
  const noName = parseAddressMessage("14 Gandhi Nagar, Jaipur 302015", "Karan S");
  assert.ok(noName.ok && noName.name === "Karan S");
  const phoneNotPin = parseAddressMessage("Karan\n14 Gandhi Nagar Jaipur\n9876543210");
  assert.equal(phoneNotPin.ok, false);
});

test("session lifecycle", () => {
  const now = 1_000_000;
  const { abandonId, session } = startSession(null, "+91 98765 43210", now);
  assert.equal(abandonId, null);
  assert.equal(session.phone, "9876543210");
  assert.equal(Date.parse(session.expires_at) - now, WA_SESSION_TTL_MS);
  const prev = { id: "s1", phone: "9876543210", status: "pending" as const, attempts: 1, expires_at: session.expires_at };
  assert.equal(startSession(prev, "919876543210", now).abandonId, "s1"); // new cart replaces pending
  assert.equal(isSessionActive(prev, now + 1000), true);
  assert.equal(isSessionActive(prev, now + WA_SESSION_TTL_MS + 1), false); // TTL
  assert.equal(isSessionActive({ ...prev, status: "ordered" }, now), false);
  assert.deepEqual(onAddressFailure(0), { attempts: 1, action: "ask-again" });
  assert.deepEqual(onAddressFailure(1), { attempts: 2, action: "fallback" });
  assert.equal(phoneKey("919876543210"), "9876543210");
});

test("pay links: exact amount, note, apps", () => {
  const link = buildUpiLink({ upiId: "shop@hdfc", payeeName: "Moon Glasses", amountPaise: 249937, orderId: "abcd1234-0000-0000-0000-000000000000" });
  const q = new URLSearchParams(link.split("?")[1]);
  assert.equal(q.get("am"), "2499.37");
  assert.equal(q.get("pa"), "shop@hdfc");
  assert.equal(q.get("tn"), "Order ABCD1234");
  assert.equal(q.get("cu"), "INR");
  const android = upiPayButtons(link, "android");
  assert.deepEqual(android.map((b) => b.name), ["Google Pay", "PhonePe", "Paytm", "Other UPI app"]);
  assert.ok(android.every((b) => b.href.includes("am=2499.37")));
  assert.ok(upiPayButtons(link, "ios")[0].href.startsWith("gpay://upi/pay?"));
  assert.ok(upiPayButtons(link, "ios")[1].href.startsWith("phonepe://"));
});

import { explicitCodes, bareCodeCandidates, stripCodes } from "./wa-address.ts";
import { buildCodeAppliedReply, buildCodeInvalidReply, buildFreeOrderReply } from "./wa-order.ts";
import { pickBestDiscount, computeTotalWithCoupon } from "./checkout-rules.ts";

test("code detection: explicit patterns", () => {
  assert.deepEqual(explicitCodes("code: FAMILY20"), ["FAMILY20"]);
  assert.deepEqual(explicitCodes("coupon family20"), ["FAMILY20"]);
  assert.deepEqual(explicitCodes("referral AB12CD"), ["AB12CD"]);
  assert.deepEqual(explicitCodes("pin code 700091"), []);
  assert.deepEqual(explicitCodes("pincode 700091"), []);
});
test("code detection: bare token and code-only message", () => {
  assert.ok(bareCodeCandidates("FAMILY20").includes("FAMILY20"));
  assert.ok(bareCodeCandidates("Aarav\n12 Park St, FAMILY20\nKolkata 700091").includes("FAMILY20"));
  assert.ok(!bareCodeCandidates("700091").length);
  assert.equal(stripCodes("code FAMILY20", ["FAMILY20"]).trim(), "");
});
test("code never leaks into the address", () => {
  const a = parseAddressMessage("Aarav Mehta\n12 Park Street, Salt Lake\nKolkata 700091\ncode: FAMILY20", null, ["FAMILY20"]);
  assert.ok(a.ok && !/FAMILY20|code/i.test(a.address) && a.pincode === "700091");
  const b = parseAddressMessage("Aarav Mehta\n12 Park Street FAMILY20 Salt Lake\nKolkata 700091", null, ["FAMILY20"]);
  assert.ok(b.ok && !/FAMILY20/i.test(b.address));
  const c = parseAddressMessage("Aarav Mehta, 12 Park Street, Kolkata 700091, coupon FAMILY20", null, ["FAMILY20"]);
  assert.ok(c.ok && !/FAMILY20|coupon/i.test(c.address));
});
test("code replies pass voice; free order has no pay link", () => {
  const cart = v([{ retailerId: "a", qty: 1 }]);
  const applied = buildCodeAppliedReply({ subtotal: 2499, discount: 500, total: 1999 });
  assert.ok(applied.includes("−₹500") && applied.includes("₹1,999"));
  const pay = buildPayReply({ cart, name: "A", address: "12 Park Street", pincode: "700091", payLink: "https://www.moon-glasses.store/pay/x", money: { subtotal: 2499, discount: 500, total: 1999 } });
  assert.ok(pay.includes("−₹500") && pay.includes("total ₹1,999"));
  const free = buildFreeOrderReply({ cart, name: "A", address: "12 Park Street", pincode: "700091" });
  assert.ok(!free.includes("/pay/") && free.includes("no payment needed, we'll message you when it ships."));
  for (const t of [applied, buildCodeInvalidReply(), pay, free, buildOrderReply(cart)]) assert.equal(hasBlock(checkVoice(t, "whatsapp")), false, t);
  assert.ok(buildOrderReply(cart).includes("have a code? send it with your details."));
});
test("stacked codes: one best discount, never below the floor", () => {
  const best = pickBestDiscount({ referral: 200, coupon: 500 });
  assert.deepEqual([best.applied, best.amount, best.dropped], ["coupon", 500, ["referral"]]);
  assert.equal(computeTotalWithCoupon(2499, 0, { applied: "coupon", amount: 9999 }, "FAMILY20") >= 1, true);
});
