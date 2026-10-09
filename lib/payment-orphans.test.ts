import { test } from "node:test";
import assert from "node:assert/strict";
import { alertHtml, alertSubject, firstName, totalOrphans } from "./payment-orphans-core.ts";

const report = {
  credits: [
    { status: "no_match" as const, payerName: "RAHUL KUMAR SHARMA" },
    { status: "ambiguous" as const, payerName: null },
  ],
  razorpayChecked: true,
  razorpayCaptures: 1,
};

test("first name only, title-cased", () => {
  assert.equal(firstName("RAHUL KUMAR SHARMA"), "Rahul");
  assert.equal(firstName("  "), null);
  assert.equal(firstName(null), null);
  assert.equal(firstName("A"), null);
});

test("subject carries counts and no customer data", () => {
  assert.equal(totalOrphans(report), 3);
  assert.equal(alertSubject(report), "Payment check: 3 payments without an order");
  assert.equal(alertSubject({ credits: [], razorpayChecked: true, razorpayCaptures: 0 }), "Payment check: every payment has an order");
  assert.doesNotMatch(alertSubject(report), /rahul/i);
});

test("body shows first names only, never the full payer name", () => {
  const html = alertHtml(report);
  assert.match(html, /Rahul/);
  assert.doesNotMatch(html, /KUMAR|SHARMA|Kumar|Sharma/);
});

test("says so when Razorpay was not checked", () => {
  assert.match(alertHtml({ ...report, razorpayChecked: false }), /Not checked/);
});
