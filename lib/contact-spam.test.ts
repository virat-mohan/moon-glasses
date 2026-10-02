import { test } from "node:test";
import assert from "node:assert/strict";
import { spamReason, issueFormToken, looksLikeGibberish, rateLimited } from "./contact-spam.ts";

const now = 1_800_000_000_000;
const tok = issueFormToken(now - 10_000);

test("the spam sample is dropped", () => {
  assert.equal(spamReason({ name: "cpTXPJVAcnuLAydzyYMW", message: "hYtqLpWxZbnMfRkd", token: tok }, now), "gibberish");
  assert.ok(looksLikeGibberish("cpTXPJVAcnuLAydzyYMW"));
});

test("real messages pass", () => {
  for (const [name, message] of [
    ["Priya", "Do you ship to Pune?"],
    ["Rahul Sharma", "Bhai yeh glasses kab tak aayenge?"],
    ["Anu", "kitne ka hai"],
    ["Mohammed", "Thanks!"],
    ["Alexander", "Hi"],
    ["McDonald", "Need a bulk order"],
  ]) assert.equal(spamReason({ name, message, token: tok }, now), null, `${name}: ${message}`);
});

test("honeypot, fast and missing token are dropped", () => {
  assert.equal(spamReason({ name: "Priya", message: "Hi", website: "x.com", token: tok }, now), "honeypot");
  assert.equal(spamReason({ name: "Priya", message: "Hi", token: issueFormToken(now - 1000) }, now), "too_fast");
  assert.equal(spamReason({ name: "Priya", message: "Hi" }, now), "no_token");
  assert.equal(spamReason({ name: "Priya", message: "Hi", token: `${now - 9000}.forged` }, now), "bad_token");
});

test("rate limit: 3 per IP per 10 minutes", () => {
  assert.equal(rateLimited("1.1.1.1", now), false);
  assert.equal(rateLimited("1.1.1.1", now), false);
  assert.equal(rateLimited("1.1.1.1", now), false);
  assert.equal(rateLimited("1.1.1.1", now), true);
  assert.equal(rateLimited("1.1.1.1", now + 11 * 60 * 1000), false);
});
