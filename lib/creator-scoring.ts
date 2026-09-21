/**
 * Automated creator-evaluation agent — same spirit as lib/ad-agent.ts
 * (bounded, logged, reasoned decisions an admin can second-guess), but this
 * one only ever recommends: it never approves or rejects on its own. Every
 * application gets scored the moment it's submitted, so /admin/creators
 * shows a ranked queue with a "why" instead of a flat list an admin has to
 * evaluate cold.
 *
 * Deliberately NOT follower-count-only — follower count is one input among
 * several, per the product principle that vanity metrics shouldn't decide
 * creator quality on their own. Every weight here is a named constant so
 * the scoring model can be tuned without hunting through logic.
 */

const FOLLOWER_BANDS: { max: number; points: number; label: string }[] = [
  { max: 500, points: 8, label: "under 500 followers — very early audience" },
  { max: 2_000, points: 18, label: "micro creator (500–2k)" },
  { max: 10_000, points: 30, label: "micro creator (2k–10k) — often the best engagement/cost ratio" },
  { max: 50_000, points: 27, label: "mid-tier creator (10k–50k)" },
  { max: 200_000, points: 20, label: "large creator (50k–200k) — reach is high, engagement typically dilutes" },
  { max: Infinity, points: 15, label: "macro/celebrity tier (200k+) — reach without guaranteed relevance for a gifting program" },
];

const PREFERRED_CATEGORIES = ["fashion", "lifestyle", "beauty", "travel"];

export type ScoreInput = {
  // null means the follower count could not be verified via Instagram
  // Business Discovery (see getPublicFollowerCount in lib/instagram.ts) —
  // e.g. a personal (not Business/Creator) account, or Meta not configured.
  // Never treat null as zero.
  followerCount: number | null;
  category: string | null;
  city: string | null;
  instagramHandle: string;
};

export type ScoreResult = {
  score: number; // 0-100
  reasons: string[];
  recommendation: "approve" | "review" | "reject";
};

export function scoreCreatorApplication(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  const followerCountVerified = input.followerCount != null;

  if (input.followerCount != null) {
    const band = FOLLOWER_BANDS.find((b) => input.followerCount! <= b.max)!;
    score += band.points;
    reasons.push(`Followers: ${input.followerCount.toLocaleString("en-IN")} — ${band.label} (+${band.points})`);
  } else {
    reasons.push(
      "Could not verify follower count via Instagram — the account may be personal rather than Business/Creator, or the handle couldn't be resolved. Verify manually before approving (+0)"
    );
  }

  const handle = input.instagramHandle.replace(/^@/, "").trim();
  if (handle.length >= 3) {
    score += 20;
    reasons.push("Valid Instagram handle provided (+20)");
  } else {
    reasons.push("Instagram handle missing or too short (+0)");
  }

  const category = (input.category ?? "").toLowerCase().trim();
  if (category && PREFERRED_CATEGORIES.includes(category)) {
    score += 30;
    reasons.push(`Category "${input.category}" fits the brand well (+30)`);
  } else if (category) {
    score += 15;
    reasons.push(`Category "${input.category}" is a looser fit (+15)`);
  } else {
    reasons.push("No category given (+0)");
  }

  if (input.city && input.city.trim().length > 1) {
    score += 20;
    reasons.push("City provided — useful for shipping/local relevance (+20)");
  }

  score = Math.min(100, Math.max(0, score));

  let recommendation: ScoreResult["recommendation"] = "reject";
  if (score >= 60) recommendation = "approve";
  else if (score >= 35) recommendation = "review";

  // An unverified follower count is a missing core signal, not a neutral
  // one — never let the agent recommend an outright approve on the other
  // signals alone; it can at most suggest a closer look.
  if (!followerCountVerified && recommendation === "approve") {
    recommendation = "review";
    reasons.push("Downgraded from APPROVE to REVIEW — follower count is unverified");
  }

  reasons.push(`Total score ${score}/100 → recommend ${recommendation.toUpperCase()}`);

  return { score, reasons, recommendation };
}
