import { test } from "node:test";
import assert from "node:assert/strict";
import { runDrip, orderSlides, dueAt, estimateTimes, type DripDeps, type DripItem, type DripRow } from "./ig-drip-core.ts";

const items: DripItem[] = ["a", "b", "c"].map((id) => ({ id, caption: "Blackout rectangle, black purple.\n\nAcetate frame. #MoonGlasses", slides: ["/s1.jpg", "/s2.jpg"], story: "/st.jpg", story_link: "https://x" }));
const row = (id: string, o: Partial<DripRow> = {}): DripRow => ({ id, status: "approved", caption: null, posted_at: null, ig_post_id: null, story_started_at: null, story_id: null, error: null, ...o });
function mk(rows: DripRow[], fail = false) {
  const calls: string[] = [];
  const deps: DripDeps = {
    rows: async () => rows,
    claimFeed: async (id, at) => { const r = rows.find((x) => x.id === id)!; if (r.posted_at || r.status !== "approved") return false; r.posted_at = at.toISOString(); return true; },
    saveFeed: async (id, p) => { rows.find((x) => x.id === id)!.ig_post_id = p; },
    claimStory: async (id) => { const r = rows.find((x) => x.id === id)!; if (r.story_started_at) return false; r.story_started_at = "x"; return true; },
    saveStory: async (id, s) => { rows.find((x) => x.id === id)!.story_id = s; },
    saveError: async (id, m) => { rows.find((x) => x.id === id)!.error = m; },
    captionBlocked: (c) => c.includes("BLOCKME"),
    postCarousel: async (u) => { calls.push("feed:" + u.join(",")); if (fail) throw new Error("boom"); return { postId: "P1" }; },
    postStory: async () => { calls.push("story"); return { postId: "S1" }; },
  };
  return { deps, calls };
}
const now = new Date("2026-10-07T10:00:00Z");

test("off by default: nothing happens", async () => {
  const { deps, calls } = mk([row("a")]);
  assert.equal((await runDrip(items, deps, { now, enabled: false })).action, "none");
  assert.deepEqual(calls, []);
});
test("never posts review or held", async () => {
  const { deps, calls } = mk([row("a", { status: "review" }), row("b", { status: "held" })]);
  assert.equal((await runDrip(items, deps, { now, enabled: true })).action, "none");
  assert.deepEqual(calls, []);
});
test("first approved goes out at once as 2 absolute slides; no double post on retry", async () => {
  const { deps, calls } = mk([row("a"), row("b")]);
  const r = await runDrip(items, deps, { now, enabled: true });
  assert.equal(r.action, "feed"); assert.equal(r.id, "a");
  assert.ok(calls[0].includes("https://www.moon-glasses.store/s2.jpg,https://www.moon-glasses.store/s1.jpg")); // product 1 is odd: model first
  const again = await runDrip(items, deps, { now: new Date(now.getTime() + 60_000), enabled: true });
  assert.equal(calls.filter((c) => c.startsWith("feed")).length, 1); assert.equal(again.action, "none");
});
test("next product only 6 hours after the previous actual post", async () => {
  const posted = new Date(now.getTime() - 5 * 3600_000).toISOString();
  const rows = [row("a", { posted_at: posted, ig_post_id: "P", story_id: "S", story_started_at: "x" }), row("b")];
  const { deps } = mk(rows);
  assert.equal((await runDrip(items, deps, { now, enabled: true })).action, "none");
  const later = new Date(now.getTime() + 61 * 60_000);
  assert.equal((await runDrip(items, deps, { now: later, enabled: true })).id, "b");
});
test("story posts 15 minutes after the carousel, not before", async () => {
  const rows = [row("a", { posted_at: new Date(now.getTime() - 10 * 60_000).toISOString(), ig_post_id: "P" })];
  const { deps } = mk(rows);
  assert.equal((await runDrip(items, deps, { now, enabled: true })).action, "none");
  const r = await runDrip(items, deps, { now: new Date(now.getTime() + 6 * 60_000), enabled: true });
  assert.equal(r.action, "story");
});
test("error is stored and stops the queue", async () => {
  const rows = [row("a"), row("b")];
  const { deps, calls } = mk(rows, true);
  assert.equal((await runDrip(items, deps, { now, enabled: true })).action, "halted");
  assert.equal(rows[0].error, "boom");
  assert.equal((await runDrip(items, deps, { now: new Date(now.getTime() + 7 * 3600_000), enabled: true })).action, "halted");
  assert.equal(calls.length, 1);
});
test("brand-book block refuses the post", async () => {
  const { deps, calls } = mk([row("a", { caption: "BLOCKME" })]);
  const r = await runDrip(items, deps, { now, enabled: true });
  assert.equal(r.action, "refused"); assert.deepEqual(calls, []);
});
test("force ignores the 6h wait but not approval", async () => {
  const rows = [row("a", { posted_at: now.toISOString(), ig_post_id: "P", story_id: "S", story_started_at: "x" }), row("b", { status: "review" })];
  const { deps } = mk(rows);
  assert.equal((await runDrip(items, deps, { now, enabled: false, force: true })).action, "none");
});
test("estimates chain 6h apart", () => {
  assert.equal(dueAt(null), null);
  const e = estimateTimes([{ id: "a", status: "approved", posted_at: null }, { id: "b", status: "approved", posted_at: null }], ["a", "b"], now);
  assert.equal(e.a, null);
  const e2 = estimateTimes([{ id: "z", status: "approved", posted_at: now.toISOString() }, { id: "a", status: "approved", posted_at: null }, { id: "b", status: "approved", posted_at: null }], ["a", "b"], now);
  assert.equal(e2.a, "2026-10-07T16:00:00.000Z"); assert.equal(e2.b, "2026-10-07T22:00:00.000Z");
});
test("slide order alternates: odd leads with model (slide2), even with product (slide1)", () => {
  assert.deepEqual(orderSlides(["s1", "s2"], 1), ["s2", "s1"]);
  assert.deepEqual(orderSlides(["s1", "s2"], 2), ["s1", "s2"]);
  assert.deepEqual(orderSlides(["s1", "s2"], 29), ["s2", "s1"]);
});
