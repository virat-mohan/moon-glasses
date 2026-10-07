// Sign-in code attempt limit (it now guards a private page, so no brute force).
//   node --experimental-strip-types --test lib/otp-attempts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideOtp, MAX_OTP_ATTEMPTS } from "./otp-attempts.ts";

const live = (over: Partial<Parameters<typeof decideOtp>[0] & object> = {}) => ({
  code: "123456",
  consumed: false,
  expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  attempts: 0,
  ...over,
});

test("the right code on a live code passes", () => assert.equal(decideOtp(live(), "123456"), "ok"));
test("a wrong code is rejected and counted", () => assert.equal(decideOtp(live(), "000000"), "wrong"));
test("after the maximum wrong tries even the right code is refused", () => {
  assert.equal(decideOtp(live({ attempts: MAX_OTP_ATTEMPTS }), "123456"), "locked");
  assert.equal(decideOtp(live({ attempts: MAX_OTP_ATTEMPTS - 1 }), "123456"), "ok");
});
test("used, expired and missing codes never pass", () => {
  assert.equal(decideOtp(live({ consumed: true }), "123456"), "none");
  assert.equal(decideOtp(live({ expires_at: new Date(Date.now() - 1000).toISOString() }), "123456"), "expired");
  assert.equal(decideOtp(null, "123456"), "none");
});
test("surrounding spaces in the typed code are ignored", () => assert.equal(decideOtp(live(), " 123456 "), "ok"));
