/** Reads a customer's one-message delivery details sent in WhatsApp. Pure, no I/O. */

export type ParsedAddress =
  | { ok: true; name: string; address: string; pincode: string; email: string | null }
  | { ok: false; reason: "no-pincode" | "multiple-pincodes" | "short-address" | "empty" };

const PIN = /(?<![0-9])[1-9][0-9]{5}(?![0-9])/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const NAME_PREFIX = /^\s*(?:my name is|name\s*[:\-=]|naam\s*[:\-=]?|mera naam|main|i am|i'm)\s*/i;
const LABEL = /^\s*(?:address|addr|pincode|pin code|pin|email|e-mail|mail)\s*[:\-=]\s*/i;

function cleanName(s: string): string | null {
  let n = s.replace(NAME_PREFIX, "").replace(/\s+(hai|hoon|hu|here)\s*$/i, "").replace(/[.,;:]+$/g, "").trim();
  if (n.length < 2 || n.length > 40) return null;
  if (!/^[\p{L}][\p{L} .'\-]*$/u.test(n)) return null;
  if (n.split(/\s+/).length > 4) return null;
  return n.replace(/\s+/g, " ");
}

const EXPLICIT_CODE = /(?<![\p{L}\p{N}])(?:promo\s*code|coupon(?:\s*code)?|referral(?:\s*code)?|code)\s*[:\-]?\s*([A-Za-z0-9_-]{3,30})(?![\p{L}\p{N}])/giu;

/** Codes named explicitly ("code: ABC", "coupon ABC", "referral ABC"). Needs a letter, so "pin code 700091" is not one. */
export function explicitCodes(text: string): string[] {
  const out: string[] = [];
  for (const m of (text ?? "").matchAll(EXPLICIT_CODE)) if (/[A-Za-z]/.test(m[1])) out.push(m[1].toUpperCase());
  return [...new Set(out)];
}

/** Bare tokens that might be a code; the caller keeps only those found in the DB. */
export function bareCodeCandidates(text: string): string[] {
  const t = (text ?? "").replace(EMAIL, " ");
  const toks = t.split(/[\s,;:()]+/).map((x) => x.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""));
  return [...new Set(toks.filter((x) => /^[A-Za-z0-9_-]{4,30}$/.test(x) && /[A-Za-z]/.test(x)).map((x) => x.toUpperCase()))].slice(0, 25);
}

export type WaMessageKind = { codes: string[]; hasPincode: boolean };

/** `known` = bare tokens the DB confirmed as real coupon/referral codes. */
export function stripCodes(text: string, codes: string[]): string {
  let t = (text ?? "").replace(EXPLICIT_CODE, (m, c) => (codes.includes(String(c).toUpperCase()) ? " " : m));
  for (const c of codes) t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${c.replace(/[-_]/g, "[-_]")}(?![\\p{L}\\p{N}])`, "giu"), " ");
  return t.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n");
}

export function parseAddressMessage(text: string, profileName?: string | null, codes: string[] = []): ParsedAddress {
  const raw = stripCodes((text ?? "").trim(), codes).trim();
  if (!raw) return { ok: false, reason: "empty" };

  const pins = [...new Set(raw.match(PIN) ?? [])];
  if (pins.length === 0) return { ok: false, reason: "no-pincode" };
  if (pins.length > 1) return { ok: false, reason: "multiple-pincodes" };
  const pincode = pins[0];

  const emailMatch = raw.match(EMAIL);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;

  let body = raw.replace(EMAIL, " ").replace(PIN, " ").replace(/(?<![0-9])[6-9][0-9]{9}(?![0-9])/g, " ");
  // Lines first; a single run of text is split on commas.
  let parts = body.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  if (parts.length === 1) parts = parts[0].split(",").map((l) => l.trim()).filter(Boolean);
  parts = parts.map((p) => p.replace(LABEL, "").trim()).filter((p) => p && !/^(pincode|pin)$/i.test(p));

  let name: string | null = null;
  if (parts.length) {
    const first = cleanName(parts[0]);
    if (first && !/\d/.test(parts[0])) {
      name = first;
      parts = parts.slice(1);
    }
  }
  if (!name) name = cleanName(profileName ?? "") ?? (profileName ? profileName.trim().slice(0, 40) : null) ?? "";
  const address = parts.join(", ").replace(/\s+/g, " ").replace(/[,\s]+$/g, "").trim();
  if (address.length < 8 || !name) return { ok: false, reason: "short-address" };
  return { ok: true, name, address, pincode, email };
}

export const ADDRESS_EXAMPLE = "Aarav Mehta\n12 Park Street, Flat 4B, Salt Lake\nKolkata 700091";
