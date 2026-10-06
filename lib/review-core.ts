// Pure review rules (no I/O) so they can be tested with node --test.
//   node --experimental-strip-types --test lib/review-core.test.ts

/** Code default. The live value is the GOOGLE_REVIEW_URL setting (see lib/reviews.ts). Unverified as Moonglasses' own profile. */
export const DEFAULT_GOOGLE_REVIEW_URL = "https://g.page/r/CbvWdBDo1oxlEBM/review";
export const INSTAGRAM_URL = "https://www.instagram.com/moonglassesonline/";
export const STORE_STRIP_MIN_REVIEWS = 5;
export const REVIEW_REMINDER_AFTER_DAYS = 5;
/** The reminder stops being useful (and looks odd) long after delivery. */
export const REVIEW_REMINDER_MAX_AGE_DAYS = 14;
export const LOW_RATING_MAX = 3;
export const MAX_REVIEW_CHARS = 1000;
export const MAX_NAME_CHARS = 60;
export const MAX_CONTACT_CHARS = 60;

export type ReviewStatus = "pending" | "approved" | "hidden";

export type PublicReview = {
  id: string;
  kind?: string | null;
  customer_name: string;
  rating: number;
  review_text: string | null;
  status?: string | null;
  approved?: boolean | null;
  verified?: boolean | null;
  admin_reply?: string | null;
  created_at: string;
};

/** Strip tags, control characters and extra whitespace; cap length. Output is plain text. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function parseRating(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export function isApproved(r: { status?: string | null; approved?: boolean | null }): boolean {
  return r.status ? r.status === "approved" : r.approved === true;
}

export function summarize(reviews: { rating: number }[]): { average: number; count: number } | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

/** Never show a tiny or fake-looking number: the homepage strip needs a real sample. */
export function shouldShowStoreStrip(count: number): boolean {
  return count >= STORE_STRIP_MIN_REVIEWS;
}

export function distribution(reviews: { rating: number }[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) d[r.rating as 1 | 2 | 3 | 4 | 5]++;
  return d;
}

const BAD_WORDS = /\b(fuck\w*|shit\w*|bitch\w*|bastard|asshole|dick\w*|cunt|slut|whore|madarchod|bhenchod|chutiya|gandu|randi|bsdk|mc|bc)\b/i;

/** Simple profanity / spam screen. Returns the reason, or null when the text looks fine. */
export function flagReason(text: string, name = ""): string | null {
  const t = `${text} ${name}`;
  if (BAD_WORDS.test(t)) return "profanity";
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|io|xyz|ru|cn)\b/i.test(t)) return "link";
  if (/(.)\1{9,}/.test(t)) return "repeated_characters";
  if (/\b(casino|crypto|forex|loan|viagra|seo service|whatsapp me|telegram)\b/i.test(t)) return "spam_words";
  if (text.length >= 8 && /^[A-Za-z]{12,}$/.test(text.trim())) return "gibberish";
  return null;
}

export type Decision = { status: ReviewStatus; flagged_reason: string | null };

/**
 * Verified (order-linked) reviews publish on their own unless the screen flags them.
 * Unverified feedback always waits for a person. Nothing is ever dropped.
 */
export function moderationDecision(input: { verified: boolean; text: string; name?: string }): Decision {
  const flagged = flagReason(input.text, input.name ?? "");
  if (flagged) return { status: "pending", flagged_reason: flagged };
  return { status: input.verified ? "approved" : "pending", flagged_reason: null };
}

export function itemKey(orderId: string, chapterSlug: string): string {
  return `${orderId}::${chapterSlug}`;
}

/** One review per order item: split the incoming slugs into new and already-reviewed. */
export function splitNewAndDuplicate(
  orderId: string,
  incomingSlugs: string[],
  existingKeys: Set<string>
): { fresh: string[]; duplicates: string[] } {
  const seen = new Set<string>();
  const fresh: string[] = [];
  const duplicates: string[] = [];
  for (const slug of incomingSlugs) {
    const k = itemKey(orderId, slug);
    if (existingKeys.has(k) || seen.has(k)) duplicates.push(slug);
    else fresh.push(slug);
    seen.add(k);
  }
  return { fresh, duplicates };
}

/** Low ratings alert the team once. They never hide or redirect the review. */
export function shouldAlertLowRating(rating: number, isTestOrder = false, alreadyAlerted = false): boolean {
  return rating <= LOW_RATING_MAX && !isTestOrder && !alreadyAlerted;
}

export type ReminderOrder = {
  is_test?: boolean | null;
  delivered_at?: string | null;
  review_requested_at?: string | null;
  review_reminded_at?: string | null;
  customer_email?: string | null;
};

export function reminderEligible(
  order: ReminderOrder,
  state: { hasReview: boolean; hasReturn: boolean },
  now = Date.now()
): boolean {
  if (order.is_test === true) return false;
  if (!order.customer_email || !order.delivered_at || !order.review_requested_at) return false;
  if (order.review_reminded_at) return false;
  if (state.hasReview || state.hasReturn) return false;
  const ageDays = (now - new Date(order.delivered_at).getTime()) / 86_400_000;
  return ageDays >= REVIEW_REMINDER_AFTER_DAYS && ageDays <= REVIEW_REMINDER_MAX_AGE_DAYS;
}

/** Product schema fragments, built only from approved product reviews. Null when there are none. */
export function buildReviewJsonLd(reviews: PublicReview[]) {
  const real = reviews.filter((r) => isApproved(r) && (r.kind ?? "product") === "product" && r.rating >= 1 && r.rating <= 5);
  const s = summarize(real);
  if (!s) return null;
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: s.average,
      reviewCount: s.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: real.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.customer_name },
      datePublished: r.created_at.slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.review_text ? { reviewBody: r.review_text } : {}),
    })),
  };
}

export function makeLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return true;
    }
    recent.push(now);
    hits.set(key, recent);
    return false;
  };
}

/** Customer-facing copy lives here so one test can check all of it against the brand voice. */
export const REVIEW_COPY = {
  requestSubject: "how are your new glasses?",
  requestBody: (name: string, items: string) =>
    `hi ${name}, hope your ${items} arrived safe and feels good on. if you have a minute, tell us how it's going. your words help the next person pick a pair.`,
  requestButton: "tell us how it's going",
  returnLine: "something not right?",
  returnLink: "request a return",
  reminderSubject: "a small note about your glasses",
  reminderBody: (name: string, items: string) =>
    `hi ${name}, just a gentle note. if you have a minute, we would love to hear how your ${items} is treating you. no rush at all, and no worries if not.`,
  pageTitle: "how was it?",
  pageIntro: "a quick rating helps other people pick the right pair. it takes under a minute.",
  textPlaceholder: "what did you think? (optional)",
  namePlaceholder: "your name (optional)",
  submit: "send my review",
  thanksTitle: "thank you, that means a lot",
  thanksBody: "your words are with us. if you feel like it, you can share them in two more places.",
  googleOption: "share it on Google",
  instagramOption: "tag @moonglassesonline on Instagram",
  feedbackTitle: "tell us how we're doing",
  feedbackIntro: "anything about the shop, the glasses or the delivery. we read every note.",
  feedbackSubmit: "send feedback",
  feedbackThanks: "thank you, we read every note. we'll look at it with care.",
  feedbackFooter: "share feedback",
  homeStrip: (avg: string, n: number) => `rated ${avg} by ${n} customers`,
  verifiedTag: "verified purchase",
  replyLabel: "reply from moonglasses",
} as const;
