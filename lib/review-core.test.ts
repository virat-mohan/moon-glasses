//   node --experimental-strip-types --test lib/review-core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REVIEW_COPY, buildReviewJsonLd, cleanText, distribution, flagReason, itemKey, makeLimiter, moderationDecision,
  reminderEligible, shouldAlertLowRating, shouldShowStoreStrip, splitNewAndDuplicate, summarize, type PublicReview,
} from "./review-core.ts";
import { BRAND_VOICE, checkVoice, hasBlock } from "./brand-voice.ts";

const DAY = 86_400_000;
const now = Date.parse("2026-10-20T00:00:00Z");

test("rating math", () => {
  assert.equal(summarize([]), null);
  assert.deepEqual(summarize([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { average: 4.3, count: 3 });
  assert.deepEqual(distribution([{ rating: 5 }, { rating: 5 }, { rating: 1 }]), { 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 });
});

test("homepage strip needs at least 5 approved reviews", () => {
  assert.equal(shouldShowStoreStrip(0), false);
  assert.equal(shouldShowStoreStrip(4), false);
  assert.equal(shouldShowStoreStrip(5), true);
});

test("verified auto-publishes, unverified waits, flagged waits", () => {
  assert.deepEqual(moderationDecision({ verified: true, text: "lovely pair, fits well" }), { status: "approved", flagged_reason: null });
  assert.equal(moderationDecision({ verified: false, text: "lovely pair" }).status, "pending");
  assert.equal(moderationDecision({ verified: true, text: "this is shit" }).status, "pending");
  assert.equal(moderationDecision({ verified: true, text: "visit www.cheap-deals.com" }).flagged_reason, "link");
  assert.equal(flagReason("great", "Asha"), null);
  assert.equal(moderationDecision({ verified: true, text: "" }).status, "approved");
});

test("html is stripped and length capped", () => {
  assert.equal(cleanText("<script>alert(1)</script>hello <b>there</b>", 100).includes("<"), false);
  assert.equal(cleanText("a".repeat(5000), 1000).length, 1000);
  assert.equal(cleanText(42, 10), "");
});

test("one review per order item", () => {
  const existing = new Set([itemKey("o1", "a")]);
  assert.deepEqual(splitNewAndDuplicate("o1", ["a", "b", "b"], existing), { fresh: ["b"], duplicates: ["a", "b"] });
  assert.deepEqual(splitNewAndDuplicate("o1", ["a"], existing).fresh, []);
});

test("low rating alert: 3 or fewer, once, never for test orders", () => {
  assert.equal(shouldAlertLowRating(3), true);
  assert.equal(shouldAlertLowRating(1), true);
  assert.equal(shouldAlertLowRating(4), false);
  assert.equal(shouldAlertLowRating(2, true), false);
  assert.equal(shouldAlertLowRating(2, false, true), false);
});

test("reminder eligibility: once, not test, not reviewed, not returned, 5 days on", () => {
  const base = { delivered_at: new Date(now - 6 * DAY).toISOString(), review_requested_at: new Date(now - 6 * DAY).toISOString(), customer_email: "a@b.com" };
  const open = { hasReview: false, hasReturn: false };
  assert.equal(reminderEligible(base, open, now), true);
  assert.equal(reminderEligible({ ...base, review_reminded_at: "x" }, open, now), false);
  assert.equal(reminderEligible({ ...base, is_test: true }, open, now), false);
  assert.equal(reminderEligible(base, { ...open, hasReview: true }, now), false);
  assert.equal(reminderEligible(base, { ...open, hasReturn: true }, now), false);
  assert.equal(reminderEligible({ ...base, delivered_at: new Date(now - 2 * DAY).toISOString() }, open, now), false);
  assert.equal(reminderEligible({ ...base, delivered_at: new Date(now - 40 * DAY).toISOString() }, open, now), false);
  assert.equal(reminderEligible({ ...base, customer_email: null }, open, now), false);
});

const rev = (o: Partial<PublicReview>): PublicReview => ({ id: "1", kind: "product", customer_name: "Asha", rating: 5, review_text: "nice", status: "approved", created_at: "2026-10-01T00:00:00Z", ...o });

test("JSON-LD only from approved product reviews", () => {
  assert.equal(buildReviewJsonLd([]), null);
  assert.equal(buildReviewJsonLd([rev({ status: "pending" }), rev({ status: "hidden" })]), null);
  assert.equal(buildReviewJsonLd([rev({ kind: "store" })]), null);
  const ld = buildReviewJsonLd([rev({}), rev({ id: "2", rating: 4 }), rev({ id: "3", status: "pending", rating: 1 })])!;
  assert.equal(ld.aggregateRating.reviewCount, 2);
  assert.equal(ld.aggregateRating.ratingValue, 4.5);
  assert.equal(ld.review.length, 2);
});

test("rate limiter blocks after the limit and recovers", () => {
  const lim = makeLimiter(2, 1000);
  assert.equal(lim("ip", 0), false);
  assert.equal(lim("ip", 1), false);
  assert.equal(lim("ip", 2), true);
  assert.equal(lim("ip", 2000), false);
});

test("all customer copy passes the brand voice with no findings", () => {
  const c = REVIEW_COPY;
  const texts = [
    c.requestSubject, c.requestBody("Asha", "Blackout, Voltage"), c.requestButton, `${c.returnLine} ${c.returnLink}`,
    c.reminderSubject, c.reminderBody("Asha", "Blackout"), c.pageTitle, c.pageIntro, c.textPlaceholder, c.namePlaceholder,
    c.submit, c.thanksTitle, c.thanksBody, c.googleOption, c.instagramOption, c.feedbackTitle, c.feedbackIntro,
    c.feedbackSubmit, c.feedbackThanks, c.feedbackFooter, c.homeStrip("4.6", 12), c.verifiedTag, c.replyLabel,
  ];
  for (const t of texts) {
    for (const kind of ["site", "email"] as const) {
      // sendEmail appends the brand sign-off to customer mail; mirror that here.
      const f = checkVoice(kind === "email" ? `${t}\n\n${BRAND_VOICE.emailSignOff}` : t, kind);
      assert.equal(hasBlock(f), false, `${kind} block: ${t}`);
      assert.deepEqual(f, [], `${kind}: ${t}`);
    }
  }
});
