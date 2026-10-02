/** Pending WhatsApp cart lifecycle rules. Pure, no I/O (the DB layer lives in wa-flow.ts). */
export const WA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const WA_MAX_ADDRESS_FAILURES = 2;

export type WaSession = {
  id: string;
  phone: string;
  status: "pending" | "ordered" | "expired" | "abandoned";
  attempts: number;
  expires_at: string;
};

/** Phone key: last 10 digits, so 919876543210, +91 98765 43210 and 9876543210 are one customer. */
export const phoneKey = (p: string) => p.replace(/\D/g, "").slice(-10);

export const isSessionActive = (s: Pick<WaSession, "status" | "expires_at"> | null | undefined, now = Date.now()) =>
  !!s && s.status === "pending" && Date.parse(s.expires_at) > now;

/** A new cart replaces any pending one for the phone (one pending per phone). */
export function startSession(prev: WaSession | null, phone: string, now = Date.now()) {
  return {
    abandonId: prev && prev.status === "pending" ? prev.id : null,
    session: { phone: phoneKey(phone), status: "pending" as const, attempts: 0, expires_at: new Date(now + WA_SESSION_TTL_MS).toISOString() },
  };
}

/** First failure: ask once more with an example. Second: web fallback link + team email. */
export function onAddressFailure(attempts: number): { attempts: number; action: "ask-again" | "fallback" } {
  const next = attempts + 1;
  return { attempts: next, action: next >= WA_MAX_ADDRESS_FAILURES ? "fallback" : "ask-again" };
}
