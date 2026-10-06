import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductTags, buildReelProductTags, decideTagging, decideTagFallback, mapCarouselProducts, fetchProductIds,
} from "./instagram-shopping-core.ts";

test("buildProductTags: max 5, clamped, spaced, never above y 0.7", () => {
  const t = buildProductTags(["1", "2", "3", "4", "5", "6", "7"]);
  assert.equal(t.length, 5);
  for (const x of t) { assert.ok(x.x >= 0.05 && x.x <= 0.95); assert.ok(x.y >= 0.7 && x.y <= 0.95); }
  assert.equal(new Set(t.map((x) => x.x)).size, 5);
  assert.deepEqual(buildProductTags(["a"]), [{ product_id: "a", x: 0.5, y: 0.84 }]);
  assert.deepEqual(buildProductTags(["a", "b", "c"]).map((x) => x.x), [0.3, 0.5, 0.7]);
  assert.equal(buildProductTags(["a"], { y: 0.1 })[0].y, 0.7);
  assert.equal(buildProductTags(["a"], { y: 5 })[0].y, 0.95);
  assert.equal(buildProductTags(["a", "a"]).length, 1);
  assert.deepEqual(buildReelProductTags(["a", "b"]), [{ product_id: "a" }, { product_id: "b" }]);
});

test("fetchProductIds maps slug to id, skips unknown/out of stock, paginates", async () => {
  const urls: string[] = [];
  const pages = [
    { data: [{ id: "11", retailer_id: "eclipse" }, { id: "12", retailer_id: "oos", availability: "out of stock" }], paging: { next: "https://x/next" } },
    { data: [{ id: "13", retailer_id: "voltage", availability: "in stock" }, { id: "99", retailer_id: "other" }] },
  ];
  let n = 0;
  const fetchFn = async (u: string) => { urls.push(u); return { ok: true, json: async () => pages[n++] }; };
  const out = await fetchProductIds(["eclipse", "oos", "voltage", "ghost"], { catalogId: "C1", token: "T", fetchFn });
  assert.deepEqual(out, { eclipse: "11", voltage: "13" });
  assert.match(urls[0], /\/C1\/products\?/);
  assert.match(decodeURIComponent(urls[0]), /is_any/);
});

test("fetchProductIds retries with plain fields when extra fields are rejected", async () => {
  let n = 0;
  const fetchFn = async () => (n++ === 0 ? { ok: false, json: async () => ({ error: { message: "bad field" } }) } : { ok: true, json: async () => ({ data: [{ id: "1", retailer_id: "a" }] }) });
  assert.deepEqual(await fetchProductIds(["a"], { catalogId: "C", token: "T", fetchFn }), { a: "1" });
});

test("decideTagging skips silently when not eligible", () => {
  assert.equal(decideTagging(false, ["1"]), "skip-not-eligible");
  assert.equal(decideTagging(true, []), "skip-no-products");
  assert.equal(decideTagging(true, ["1"]), "tag");
});

test("tag fallback: retry once without tags, else throw", () => {
  assert.equal(decideTagFallback(true, false), "retry-without-tags");
  assert.equal(decideTagFallback(true, true), "throw");
  assert.equal(decideTagFallback(false, false), "throw");
});

test("carousel mapping", () => {
  assert.deepEqual(mapCarouselProducts(3, ["a", "b", "c"]), [["a"], ["b"], ["c"]]);
  assert.deepEqual(mapCarouselProducts(4, ["a"]), [["a"], undefined, undefined, undefined]);
  assert.deepEqual(mapCarouselProducts(3, ["a", "b"]), [["a"], undefined, undefined]);
  assert.deepEqual(mapCarouselProducts(2, ["a", undefined]), [["a"], undefined]);
  assert.deepEqual(mapCarouselProducts(2, []), [undefined, undefined]);
});
