// Contact form spam guard: honeypot, signed render time, gibberish, rate limit.
import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_SUBMIT_MS = 3000;
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.CONTACT_FORM_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "contact-form-fallback-secret";
}

function sign(ts: string): string {
  return createHmac("sha256", secret()).update(`contact:${ts}`).digest("hex").slice(0, 32);
}

export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

/** Returns a reason when the token is missing, forged, too fresh or too old. */
export function checkFormToken(token: unknown, now = Date.now()): string | null {
  if (typeof token !== "string") return "no_token";
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return "bad_token";
  const expected = sign(ts);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return "bad_token";
  const age = now - Number(ts);
  if (!Number.isFinite(age) || age < MIN_SUBMIT_MS) return "too_fast";
  if (age > MAX_TOKEN_AGE_MS) return "token_expired";
  return null;
}

/** Conservative: only flags a single long letter run, or random mixed case with few vowels. */
export function looksLikeGibberish(text: string): boolean {
  const t = text.trim();
  if (/^[A-Za-z]{12,}$/.test(t)) return true;
  if (/\s/.test(t) || t.length < 8 || !/^[A-Za-z]+$/.test(t)) return false;
  // Random mixed case: several case flips inside one word, and a low vowel share.
  const flips = (t.match(/[a-z][A-Z]|[A-Z][a-z]/g) ?? []).length;
  const vowels = (t.match(/[aeiou]/gi) ?? []).length / t.length;
  return flips >= 4 && vowels < 0.3;
}

const hits = new Map<string, number[]>();
export const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/** At most 3 per IP per 10 minutes (per server instance). */
export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export type SpamInput = { name: string; message: string; website?: unknown; token?: unknown };

/** Returns why a submission is spam, or null if it looks real. */
export function spamReason(input: SpamInput, now = Date.now()): string | null {
  if (typeof input.website === "string" && input.website.trim() !== "") return "honeypot";
  const tokenIssue = checkFormToken(input.token, now);
  if (tokenIssue) return tokenIssue;
  if (looksLikeGibberish(input.name) || looksLikeGibberish(input.message)) return "gibberish";
  return null;
}
