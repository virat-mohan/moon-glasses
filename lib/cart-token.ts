import crypto from "node:crypto";

/**
 * Signed cart link token. Carries ONLY [{s: slug, q: qty}] and an expiry.
 * No phone, name or price. Key = HMAC(SUPABASE_SERVICE_ROLE_KEY, fixed label),
 * so there is no new secret to configure.
 */
const LABEL = "moonglasses-wa-cart-v1";
export const CART_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CartTokenLine = { s: string; q: number };

function key(secret?: string): Buffer {
  const base = secret ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("no secret available for cart token");
  return crypto.createHmac("sha256", base).update(LABEL).digest();
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signCartToken(lines: CartTokenLine[], opts: { now?: number; secret?: string } = {}): string {
  const exp = Math.floor(((opts.now ?? Date.now()) + CART_TOKEN_TTL_MS) / 1000);
  const body = b64(JSON.stringify({ i: lines.map((l) => ({ s: l.s, q: l.q })), e: exp }));
  const sig = b64(crypto.createHmac("sha256", key(opts.secret)).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyResult = { ok: true; lines: CartTokenLine[] } | { ok: false; reason: "malformed" | "tampered" | "expired" };

export function verifyCartToken(token: string, opts: { now?: number; secret?: string } = {}): VerifyResult {
  if (typeof token !== "string" || token.length > 4000) return { ok: false, reason: "malformed" };
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "malformed" };
  let expected: Buffer;
  try {
    expected = crypto.createHmac("sha256", key(opts.secret)).update(body).digest();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: "tampered" };
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!Array.isArray(p.i) || typeof p.e !== "number") return { ok: false, reason: "malformed" };
    if (p.e * 1000 < (opts.now ?? Date.now())) return { ok: false, reason: "expired" };
    const lines = p.i.map((l: { s: unknown; q: unknown }) => ({ s: String(l.s), q: Number(l.q) }));
    return { ok: true, lines };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
