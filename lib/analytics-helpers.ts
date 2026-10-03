/**
 * Pure helpers for /admin/analytics (no imports so node --test can load them).
 * Definitions here are the ones printed on the page's "How to read this page".
 */

export const VISIT_GAP_MS = 30 * 60 * 1000;

/** Standard 30-minute inactivity rule: a gap longer than 30 minutes starts a new visit. */
export function splitVisits(timestamps: number[], gapMs: number = VISIT_GAP_MS): number {
  if (timestamps.length === 0) return 0;
  const sorted = [...timestamps].sort((a, b) => a - b);
  let visits = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > gapMs) visits++;
  }
  return visits;
}

export const SOURCE_GROUPS = ["Instagram", "WhatsApp", "Direct", "Google", "Other"] as const;
export type SourceGroup = (typeof SOURCE_GROUPS)[number];

// Fixed UTM list from docs/GROWTH-MACHINE.md (values are lower case).
const INSTAGRAM_UTMS = new Set(["reel", "instagram", "ig", "meta", "facebook", "fb", "founder"]);
const GOOGLE_UTMS = new Set(["google", "google_merchant"]);

export function groupSource(ev: {
  ad_brief_id?: string | null;
  utm_source?: string | null;
  referrer_host?: string | null;
}): { group: SourceGroup; adClick: boolean } {
  const adClick = !!ev.ad_brief_id;
  // Our own Meta ads run on Instagram and Facebook, so they sit in the Instagram group (flagged as ad clicks).
  if (adClick) return { group: "Instagram", adClick };
  const utm = ev.utm_source?.trim().toLowerCase();
  if (utm) {
    if (utm === "whatsapp") return { group: "WhatsApp", adClick };
    if (INSTAGRAM_UTMS.has(utm) || utm.startsWith("founder_")) return { group: "Instagram", adClick };
    if (GOOGLE_UTMS.has(utm)) return { group: "Google", adClick };
    return { group: "Other", adClick }; // referral, email, creator_*, pwap, b2b, partners...
  }
  const host = ev.referrer_host?.toLowerCase();
  if (!host) return { group: "Direct", adClick };
  if (/wa\.me|whatsapp\.com/.test(host)) return { group: "WhatsApp", adClick };
  if (/instagram\.com|facebook\.com|fb\.com|l\.instagram|lm\.facebook/.test(host)) return { group: "Instagram", adClick };
  if (/(^|\.)google\./.test(host)) return { group: "Google", adClick };
  return { group: "Other", adClick };
}

export type FunnelStep = { key: string; label: string; count: number; pctOfPrevious: number | null };
export type BiggestDrop = { from: string; to: string; lost: number; lostPct: number } | null;

export function buildFunnel(counts: { visitors: number; viewedProduct: number; addedToCart: number; startedCheckout: number; paid: number }): {
  steps: FunnelStep[];
  biggestDrop: BiggestDrop;
} {
  const raw: [string, string, number][] = [
    ["visitors", "Visitors", counts.visitors],
    ["viewedProduct", "Viewed a product", counts.viewedProduct],
    ["addedToCart", "Added to cart", counts.addedToCart],
    ["startedCheckout", "Started checkout", counts.startedCheckout],
    ["paid", "Paid", counts.paid],
  ];
  const steps: FunnelStep[] = raw.map(([key, label, count], i) => ({
    key,
    label,
    count,
    pctOfPrevious: i === 0 ? null : raw[i - 1][2] > 0 ? count / raw[i - 1][2] : 0,
  }));
  let biggestDrop: BiggestDrop = null;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].count;
    if (prev <= 0) continue;
    const lost = Math.max(0, prev - steps[i].count);
    const lostPct = lost / prev;
    if (!biggestDrop || lostPct > biggestDrop.lostPct) {
      biggestDrop = { from: steps[i - 1].label, to: steps[i].label, lost, lostPct };
    }
  }
  return { steps, biggestDrop };
}

export function biggestDropSentence(d: BiggestDrop): string {
  if (!d) return "Not enough visitors yet to see where people drop off.";
  return `Biggest drop: ${Math.round(d.lostPct * 100)}% of people who reached "${d.from}" did not go on to "${d.to}" (${d.lost.toLocaleString("en-IN")} people).`;
}

/** Team traffic: any visitor who opened an /admin page is the team, not a customer. */
export function isTeamVisitor(paths: (string | null | undefined)[]): boolean {
  return paths.some((p) => !!p && (p === "/admin" || p.startsWith("/admin/")));
}

/** Bounce: saw exactly one page and did nothing further (no cart, checkout or purchase). */
export function isBounce(summary: { pageViews: number; addedToCart: boolean; startedCheckout: boolean; purchased: boolean }): boolean {
  return summary.pageViews <= 1 && !summary.addedToCart && !summary.startedCheckout && !summary.purchased;
}

export type RangePreset = "today" | "7d" | "30d" | "custom";

function shiftDay(day: string, deltaDays: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Inclusive date range ending today (IST day string passed in). */
export function presetRange(preset: Exclude<RangePreset, "custom">, today: string): { from: string; to: string } {
  if (preset === "today") return { from: today, to: today };
  return { from: shiftDay(today, preset === "7d" ? -6 : -29), to: today };
}

export function pctText(n: number) {
  return `${Math.round(n * 100)}%`;
}
