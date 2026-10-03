import test from "node:test";
import assert from "node:assert/strict";
import {
  biggestDropSentence,
  buildFunnel,
  groupSource,
  isBounce,
  isTeamVisitor,
  presetRange,
  splitVisits,
} from "./analytics-helpers.ts";

const MIN = 60 * 1000;

test("splitVisits: 30-minute inactivity rule", () => {
  assert.equal(splitVisits([]), 0);
  assert.equal(splitVisits([0]), 1);
  assert.equal(splitVisits([0, 10 * MIN, 25 * MIN]), 1);
  assert.equal(splitVisits([0, 30 * MIN]), 1); // exactly 30 min is still the same visit
  assert.equal(splitVisits([0, 31 * MIN]), 2);
  assert.equal(splitVisits([90 * MIN, 0, 10 * MIN, 200 * MIN]), 3); // unsorted input
});

test("groupSource: fixed UTM list, referrers, ad clicks", () => {
  assert.deepEqual(groupSource({ utm_source: "whatsapp" }), { group: "WhatsApp", adClick: false });
  assert.equal(groupSource({ utm_source: "reel" }).group, "Instagram");
  assert.equal(groupSource({ utm_source: "founder_moon_2026" }).group, "Instagram");
  assert.equal(groupSource({ utm_source: "google_merchant" }).group, "Google");
  assert.equal(groupSource({ utm_source: "creator_asha" }).group, "Other");
  assert.equal(groupSource({ utm_source: "email" }).group, "Other");
  assert.equal(groupSource({}).group, "Direct");
  assert.equal(groupSource({ referrer_host: "l.instagram.com" }).group, "Instagram");
  assert.equal(groupSource({ referrer_host: "www.google.com" }).group, "Google");
  assert.equal(groupSource({ referrer_host: "wa.me" }).group, "WhatsApp");
  assert.equal(groupSource({ referrer_host: "bing.com" }).group, "Other");
  assert.deepEqual(groupSource({ ad_brief_id: "x", utm_source: "whatsapp" }), { group: "Instagram", adClick: true });
});

test("buildFunnel: % of previous step and biggest drop", () => {
  const { steps, biggestDrop } = buildFunnel({ visitors: 1000, viewedProduct: 400, addedToCart: 80, startedCheckout: 40, paid: 20 });
  assert.equal(steps[0].pctOfPrevious, null);
  assert.equal(steps[1].pctOfPrevious, 0.4);
  assert.equal(steps[4].pctOfPrevious, 0.5);
  assert.equal(biggestDrop?.from, "Viewed a product");
  assert.equal(biggestDrop?.to, "Added to cart");
  assert.match(biggestDropSentence(biggestDrop), /80%/);
  assert.equal(buildFunnel({ visitors: 0, viewedProduct: 0, addedToCart: 0, startedCheckout: 0, paid: 0 }).biggestDrop, null);
});

test("team visitors and bounce", () => {
  assert.equal(isTeamVisitor(["/", "/admin/orders"]), true);
  assert.equal(isTeamVisitor(["/", "/administrator-shoes"]), false);
  assert.equal(isBounce({ pageViews: 1, addedToCart: false, startedCheckout: false, purchased: false }), true);
  assert.equal(isBounce({ pageViews: 2, addedToCart: false, startedCheckout: false, purchased: false }), false);
  assert.equal(isBounce({ pageViews: 1, addedToCart: true, startedCheckout: false, purchased: false }), false);
});

test("presetRange", () => {
  assert.deepEqual(presetRange("today", "2026-10-03"), { from: "2026-10-03", to: "2026-10-03" });
  assert.deepEqual(presetRange("7d", "2026-10-03"), { from: "2026-09-27", to: "2026-10-03" });
  assert.deepEqual(presetRange("30d", "2026-10-03"), { from: "2026-09-04", to: "2026-10-03" });
});
