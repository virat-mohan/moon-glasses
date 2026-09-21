"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const SESSION_KEY_STORAGE = "moonglasses-session-key";
const ATTRIBUTION_STORAGE = "moonglasses-attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30-day last-click attribution window

/**
 * Captures the `ab` (ad brief id) query param a launched campaign's landing
 * URL carries — see the launch route in app/api/admin/ad-briefs/launch —
 * and persists it so it survives browsing between the ad click and
 * eventually checking out. Last-click wins: a newer `ab` overwrites an
 * older one, same convention as every standard attribution model.
 * Deliberately reads window.location directly rather than useSearchParams,
 * since that hook forces a Suspense boundary on the page using it — this
 * needs to run globally on every page without adding that constraint
 * everywhere.
 */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const adBriefId = params.get("ab");
  if (!adBriefId) return;
  localStorage.setItem(
    ATTRIBUTION_STORAGE,
    JSON.stringify({ adBriefId, capturedAt: Date.now() })
  );
}

const UTM_SOURCE_STORAGE = "moonglasses-utm-source";
const UTM_SOURCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Captures a manually-tagged `?utm_source=` (e.g. a WhatsApp broadcast link
 * tagged `utm_source=whatsapp`) — needed because WhatsApp's in-app browser
 * usually strips document.referrer entirely, so referrer alone can't tell a
 * WhatsApp click apart from direct traffic.
 */
export function captureUtmSource() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source");
  if (!source) return;
  localStorage.setItem(UTM_SOURCE_STORAGE, JSON.stringify({ source, capturedAt: Date.now() }));
}

function getUtmSource(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(UTM_SOURCE_STORAGE);
    if (!raw) return null;
    const { source, capturedAt } = JSON.parse(raw);
    if (Date.now() - capturedAt > UTM_SOURCE_TTL_MS) return null;
    return source ?? null;
  } catch {
    return null;
  }
}

const REFERRAL_STORAGE = "moonglasses-referral";
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Same pattern as captureAttribution, for a `?ref=<code>` referral link. */
export function captureReferral() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("ref");
  if (!code) return;
  localStorage.setItem(REFERRAL_STORAGE, JSON.stringify({ code, capturedAt: Date.now() }));
}

/** The still-valid referral code, if any, to apply at checkout. */
export function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE);
    if (!raw) return null;
    const { code, capturedAt } = JSON.parse(raw);
    if (Date.now() - capturedAt > REFERRAL_TTL_MS) return null;
    return code ?? null;
  } catch {
    return null;
  }
}

const COUPON_STORAGE = "moonglasses-coupon";
const COUPON_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Same pattern as captureReferral, for a `?coupon=<code>` link — this is
 * what makes a "Pay With A Post" code an actual clickable link rather than
 * just text someone has to remember and retype: a Story link sticker or
 * bio link to moon-glasses.store/?coupon=CODE lands here, gets remembered,
 * and auto-fills the coupon field the moment they reach checkout.
 */
export function captureCoupon() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("coupon");
  if (!code) return;
  localStorage.setItem(COUPON_STORAGE, JSON.stringify({ code, capturedAt: Date.now() }));
}

/** The still-valid captured coupon code, if any, to pre-fill at checkout. */
export function getCapturedCoupon(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COUPON_STORAGE);
    if (!raw) return null;
    const { code, capturedAt } = JSON.parse(raw);
    if (Date.now() - capturedAt > COUPON_TTL_MS) return null;
    return code ?? null;
  } catch {
    return null;
  }
}

/** The still-valid attributed ad brief id, if any, for stamping onto an order at checkout. */
export function getAttribution(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE);
    if (!raw) return null;
    const { adBriefId, capturedAt } = JSON.parse(raw);
    if (Date.now() - capturedAt > ATTRIBUTION_TTL_MS) return null;
    return adBriefId ?? null;
  } catch {
    return null;
  }
}

/** A stable per-browser id used to correlate cart_sessions, tracking_events and orders. */
export function getSessionKey() {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(SESSION_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY_STORAGE, key);
  }
  return key;
}

type TrackParams = { chapterSlug?: string; value?: number; currency?: string };

/**
 * Fires an event to both the Meta pixel (if loaded) and our own first-party
 * log — the first-party log is the one /admin/reports actually trusts, since
 * it isn't affected by ad blockers or cookie consent state.
 */
export function trackEvent(
  eventName: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase",
  params: TrackParams = {}
) {
  if (typeof window === "undefined") return;

  if (window.fbq) {
    if (params.value != null) {
      window.fbq("track", eventName, { value: params.value, currency: params.currency ?? "INR" });
    } else {
      window.fbq("track", eventName);
    }
  }

  // Referrer only matters as an entry signal — capture it on the PageView
  // that started the session, not on every later interaction — and only
  // when it's actually an external site (a same-origin referrer just means
  // in-app navigation, not a traffic source).
  let referrerHost: string | undefined;
  let adBriefId: string | undefined;
  let utmSource: string | undefined;
  if (eventName === "PageView") {
    if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.hostname !== window.location.hostname) referrerHost = ref.hostname;
      } catch {
        // malformed referrer — ignore
      }
    }
    adBriefId = getAttribution() ?? undefined;
    utmSource = getUtmSource() ?? undefined;
  }

  fetch("/api/tracking/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      sessionKey: getSessionKey(),
      path: window.location.pathname,
      referrerHost,
      adBriefId,
      utmSource,
      ...params,
    }),
  }).catch(() => {});
}
