// Pure rules for Pay With A Post kits: cap, sales counting, session match.

export const DEFAULT_MAX_POSTS_PER_ORDER = 5;

export function canAddKit(currentKits: number, maxPostsPerOrder: number): boolean {
  return currentKits < Math.max(1, Math.floor(maxPostsPerOrder));
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const phone10 = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);

export type Redemption = { code: string; order_id: string | null; customer_phone?: string | null; customer_email?: string | null };

/**
 * Friends' sales across ALL of an order's codes. A friend order counts once
 * per PWAP order (dedupe by order id) even if it somehow shows up twice or
 * under two codes; only PAID orders count; never the owner's own phone/email.
 * Per-code numbers use the same rules (each friend order counted once on the
 * code it used).
 */
export function countFriendSales(
  redemptions: Redemption[],
  paidOrderIds: Set<string>,
  owner: { phone?: string | null; email?: string | null }
): { total: number; byCode: Record<string, number> } {
  const ownerPhone = phone10(owner.phone);
  const ownerEmail = norm(owner.email);
  const seen = new Set<string>();
  const byCodeSeen = new Map<string, Set<string>>();
  for (const r of redemptions) {
    if (!r.order_id || !paidOrderIds.has(r.order_id)) continue;
    if (ownerPhone && phone10(r.customer_phone) === ownerPhone) continue;
    if (ownerEmail && norm(r.customer_email) === ownerEmail) continue;
    const code = r.code.toUpperCase();
    if (seen.has(r.order_id)) continue; // already counted on the first code it used
    seen.add(r.order_id);
    const set = byCodeSeen.get(code) ?? new Set<string>();
    set.add(r.order_id);
    byCodeSeen.set(code, set);
  }
  const byCode: Record<string, number> = {};
  for (const [code, set] of byCodeSeen) byCode[code] = set.size;
  return { total: seen.size, byCode };
}

/** Whether a signed-in customer's email is the order's email (case-insensitive). No email on either side = no match. */
export function sessionEmailMatchesOrder(sessionEmail: string | null | undefined, orderEmail: string | null | undefined): boolean {
  const a = norm(sessionEmail);
  const b = norm(orderEmail);
  return !!a && !!b && a === b;
}

export type BarterAccess = "ok" | "needs_login" | "open_legacy";

/** Orders with no email keep the old open link (nothing sensitive); everything else needs a matching session. */
export function barterAccessFor(orderEmail: string | null | undefined, sessionEmail: string | null | undefined): BarterAccess {
  if (!norm(orderEmail)) return "open_legacy";
  return sessionEmailMatchesOrder(sessionEmail, orderEmail) ? "ok" : "needs_login";
}

/** The sign-in prompt never says whether the email matched. */
export const BARTER_CODE_SENT_MESSAGE = "if that email matches this order, we've sent a one-time code. it lasts 10 minutes.";
