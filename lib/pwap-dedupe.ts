/**
 * The "one active Pay With A Post order per person" lookup (PostgREST .or()).
 * Pure, so it is unit-tested. Only present identifiers are matched: an empty
 * Instagram handle (no handle is asked since sell first is the only model)
 * must never become `barter_instagram_handle.ilike.` and match every
 * handle-less order, which would block everyone after the first.
 */
export function pwapDedupeOrFilter(input: { phone?: string | null; email?: string | null; handle?: string | null }): string | null {
  const clauses: string[] = [];
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  const handle = input.handle?.trim();
  if (phone) clauses.push(`customer_phone.eq.${phone}`);
  if (email) clauses.push(`customer_email.eq.${email}`);
  if (handle) clauses.push(`barter_instagram_handle.ilike.${handle}`);
  return clauses.length ? clauses.join(",") : null;
}

/** Same rule in memory: does an existing active PWAP order belong to this person? */
export function pwapIsSamePerson(
  existing: { customer_phone?: string | null; customer_email?: string | null; barter_instagram_handle?: string | null },
  input: { phone?: string | null; email?: string | null; handle?: string | null }
): boolean {
  const eq = (a?: string | null, b?: string | null) => !!a?.trim() && !!b?.trim() && a.trim() === b.trim();
  const eqi = (a?: string | null, b?: string | null) => !!a?.trim() && !!b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();
  return eq(existing.customer_phone, input.phone) || eq(existing.customer_email, input.email) || eqi(existing.barter_instagram_handle, input.handle);
}
