import { test } from "node:test";
import assert from "node:assert/strict";
import { selectReshares } from "./tagged-reshare-select.ts";

const now = new Date("2026-10-02T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const item = (id: string, h: number, username = "fan") => ({ id, username, timestamp: hoursAgo(h) });

test("recent, unhandled item is posted", () => {
  const r = selectReshares({ items: [item("a", 2)], handledIds: new Set(), ownUsername: "moonglassesonline", now, firstRun: false });
  assert.deepEqual(r.post.map((x) => x.id), ["a"]);
  assert.equal(r.skip.length, 0);
});

test("already handled items are ignored entirely", () => {
  const r = selectReshares({ items: [item("a", 2)], handledIds: new Set(["a"]), ownUsername: null, now, firstRun: false });
  assert.equal(r.post.length + r.skip.length + r.deferred.length, 0);
});

test("older than 7 days is skipped with a reason, never posted", () => {
  const r = selectReshares({ items: [item("old", 24 * 8), item("edge", 24 * 7 - 1)], handledIds: new Set(), ownUsername: null, now, firstRun: false });
  assert.deepEqual(r.post.map((x) => x.id), ["edge"]);
  assert.equal(r.skip[0].item.id, "old");
  assert.match(r.skip[0].reason, /Older than 7 days/);
});

test("first run seeds the old backlog as handled without posting it", () => {
  const items = [item("o1", 24 * 30), item("o2", 24 * 10), item("new", 1)];
  const r = selectReshares({ items, handledIds: new Set(), ownUsername: null, now, firstRun: true });
  assert.deepEqual(r.post.map((x) => x.id), ["new"]);
  assert.deepEqual(r.skip.map((s) => s.item.id).sort(), ["o1", "o2"]);
  assert.ok(r.skip.every((s) => /switched on/.test(s.reason)));
});

test("our own account is skipped, case and @ insensitive", () => {
  const r = selectReshares({ items: [item("me", 1, "@MoonGlassesOnline")], handledIds: new Set(), ownUsername: "moonglassesonline", now, firstRun: false });
  assert.equal(r.post.length, 0);
  assert.equal(r.skip[0].reason, "Our own account");
});

test("max 5 per run; the rest are deferred unrecorded, oldest first", () => {
  const items = Array.from({ length: 8 }, (_, i) => item(`p${i}`, 10 - i));
  const r = selectReshares({ items, handledIds: new Set(), ownUsername: null, now, firstRun: false });
  assert.deepEqual(r.post.map((x) => x.id), ["p0", "p1", "p2", "p3", "p4"]);
  assert.deepEqual(r.deferred.map((x) => x.id), ["p5", "p6", "p7"]);
  assert.equal(r.skip.length, 0);
});

test("bad timestamp is treated as too old; duplicate ids handled once", () => {
  const r = selectReshares({ items: [{ id: "x", username: "a", timestamp: "nope" }, item("d", 1), item("d", 1)], handledIds: new Set(), ownUsername: null, now, firstRun: false });
  assert.deepEqual(r.post.map((x) => x.id), ["d"]);
  assert.equal(r.skip[0].item.id, "x");
});
