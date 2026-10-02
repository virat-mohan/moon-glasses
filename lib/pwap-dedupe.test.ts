import { test } from "node:test";
import assert from "node:assert/strict";
import { pwapDedupeOrFilter, pwapIsSamePerson } from "./pwap-dedupe.ts";

test("no handle: filter has phone + email only, never an empty handle clause", () => {
  const f = pwapDedupeOrFilter({ phone: "9000000001", email: "a@x.in", handle: "" });
  assert.equal(f, "customer_phone.eq.9000000001,customer_email.eq.a@x.in");
  assert.ok(!f!.includes("barter_instagram_handle"));
  assert.equal(pwapDedupeOrFilter({ phone: "9000000001", email: "a@x.in", handle: null }), f);
});

test("handle given: handle clause included", () => {
  assert.equal(
    pwapDedupeOrFilter({ phone: "9", email: "a@x.in", handle: "moon" }),
    "customer_phone.eq.9,customer_email.eq.a@x.in,barter_instagram_handle.ilike.moon"
  );
});

test("nothing to match on: null", () => {
  assert.equal(pwapDedupeOrFilter({ phone: " ", email: "", handle: "" }), null);
});

test("two different customers with no handle can both create PWAP orders", () => {
  const first = { customer_phone: "9000000001", customer_email: "a@x.in", barter_instagram_handle: null };
  const second = { phone: "9000000002", email: "b@x.in", handle: "" };
  assert.equal(pwapIsSamePerson(first, second), false);
  // ...while the same person retrying is still deduped
  assert.equal(pwapIsSamePerson(first, { phone: "9000000001", email: "other@x.in", handle: "" }), true);
  assert.equal(pwapIsSamePerson({ ...first, barter_instagram_handle: "Moon" }, { phone: "1", email: "c@x.in", handle: "moon" }), true);
});
