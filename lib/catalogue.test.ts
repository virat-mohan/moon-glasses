// pinFirst: the merchandising pin for the Limited Edition Drop.
//   node --experimental-strip-types --test lib/catalogue.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pinFirst } from "./catalogue.ts";

const flat = [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "d" }];
const tiles = flat.map((s) => ({ chapter: { slug: s.slug } }));

test("moves the pinned pair to the front, the rest keep their order", () => {
  assert.deepEqual(pinFirst(flat, "c").map((x) => x.slug), ["c", "a", "b", "d"]);
  assert.deepEqual(pinFirst(tiles, "d").map((x) => x.chapter.slug), ["d", "a", "b", "c"]);
});

test("empty, unknown or already-first slug leaves the order alone", () => {
  for (const s of [undefined, null, "", "  ", "zzz", "a"]) assert.deepEqual(pinFirst(flat, s).map((x) => x.slug), ["a", "b", "c", "d"]);
});

test("does not mutate the input", () => {
  const copy = [...flat];
  pinFirst(flat, "c");
  assert.deepEqual(flat, copy);
});
