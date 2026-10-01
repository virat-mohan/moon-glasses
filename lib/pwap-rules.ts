import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Every Pay With A Post number in one place, edited in Admin › Pay With A
 * Post › Rules and stored as one JSON row (app_settings PWAP_RULES). Any rule
 * left unset falls back to the default below.
 */
export type PwapRules = {
  /** Sales on the customer's code before their own pair ships free. */
  salesToShip: number;
  /** After that, every this many more sales earns a free-pair code. */
  salesPerFreeCode: number;
  /** Value of a free-pair code (₹, flat). Covers the dearest pair. */
  freeCodeValueRupees: number;
  /** Days a free-pair code stays valid. */
  freeCodeValidDays: number;
  /** Discount a friend gets with the customer's code (₹). 0 = full price. */
  friendDiscountRupees: number;
  /** "We ship first" for big accounts. Off until launched. */
  shipFirstEnabled: boolean;
  /** Followers needed for "we ship first". */
  shipFirstMinFollowers: number;
  /** Max "we ship first" orders per day. */
  shipFirstDailyCap: number;
  /** One "we ship first" per Instagram account per this many days. */
  shipFirstCooldownDays: number;
  /** Real-audience check for "we ship first": posts on the account. */
  shipFirstMinPosts: number;
  /** Real-audience check: median likes at least this… */
  shipFirstMinMedianLikes: number;
  /** …and at least this % of followers. */
  shipFirstMinLikesPct: number;
};

export const DEFAULT_PWAP_RULES: PwapRules = {
  salesToShip: 3,
  salesPerFreeCode: 3,
  freeCodeValueRupees: 2499,
  freeCodeValidDays: 90,
  friendDiscountRupees: 0,
  shipFirstEnabled: false,
  shipFirstMinFollowers: 10000,
  shipFirstDailyCap: 10,
  shipFirstCooldownDays: 90,
  shipFirstMinPosts: 9,
  shipFirstMinMedianLikes: 20,
  shipFirstMinLikesPct: 0.5,
};

export async function getPwapRules(): Promise<PwapRules> {
  const { data } = await getSupabaseServerClient()
    .from("app_settings")
    .select("value")
    .eq("key", "PWAP_RULES")
    .maybeSingle();
  let saved: Partial<PwapRules> = {};
  try {
    saved = data?.value ? JSON.parse(data.value) : {};
  } catch {}
  return { ...DEFAULT_PWAP_RULES, ...saved };
}

/** Saves only known rules, as numbers/booleans, rejecting nonsense values. */
export async function savePwapRules(input: Record<string, unknown>): Promise<PwapRules> {
  const current = await getPwapRules();
  const next: PwapRules = { ...current };
  for (const key of Object.keys(DEFAULT_PWAP_RULES) as (keyof PwapRules)[]) {
    if (!(key in input)) continue;
    const v = input[key];
    if (typeof DEFAULT_PWAP_RULES[key] === "boolean") {
      if (typeof v === "boolean") (next as Record<string, unknown>)[key] = v;
    } else {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) (next as Record<string, unknown>)[key] = n;
    }
  }
  next.salesToShip = Math.max(1, Math.round(next.salesToShip));
  next.salesPerFreeCode = Math.max(1, Math.round(next.salesPerFreeCode));
  const { error } = await getSupabaseServerClient()
    .from("app_settings")
    .upsert({ key: "PWAP_RULES", value: JSON.stringify(next) }, { onConflict: "key" });
  if (error) throw error;
  return next;
}
