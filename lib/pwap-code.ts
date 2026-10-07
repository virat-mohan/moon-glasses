// Pay With A Post codes: FIRSTNAME + THEME word, e.g. VIRATSTARLIT.
// Pure (no imports) so it is unit-tested directly.

export const THEME_WORDS = [
  "AFTERGLOW",
  "MIDNIGHT",
  "MOONLIT",
  "NIGHTFALL",
  "STARLIT",
  "NEONNIGHTS",
  "AFTERDARK",
  "DUSKFALL",
  "GLOWUP",
  "NIGHTOWL",
] as const;

export const MAX_BARTER_CODE_LENGTH = 16;
const MAX_NAME_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

// Never let a customer's name or a clash produce one of these inside a code.
const BLOCKED_FRAGMENTS = ["FUCK", "SHIT", "CUNT", "DICK", "COCK", "PUSSY", "BITCH", "SLUT", "WHORE", "RAPE", "NAZI", "NIGGA", "NIGGER", "ASSHOLE", "BHENCHOD", "MADARCHOD", "CHUTIYA", "GAAND", "LUND", "RANDI", "BSDK"];

/** Letters only, uppercase, max 8. Falls back to the Instagram handle's letters, then MOON. */
export function codeBaseFromName(name: string, handleFallback = ""): string {
  const letters = (s: string) => s.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const first = letters((name ?? "").trim().split(/\s+/)[0] ?? "").slice(0, MAX_NAME_LENGTH);
  if (first.length >= 1) return first;
  const fromHandle = letters(handleFallback).slice(0, MAX_NAME_LENGTH);
  return fromHandle || "MOON";
}

export function isValidBarterCode(code: string): boolean {
  return /^[A-Z0-9]+$/.test(code) && code.length >= 3 && code.length <= MAX_BARTER_CODE_LENGTH && !hasBlockedFragment(code);
}

export function hasBlockedFragment(code: string): boolean {
  const up = code.toUpperCase();
  return BLOCKED_FRAGMENTS.some((w) => up.includes(w));
}

/** Fit base + theme (+ number) into 16 characters by shortening the name, never the theme. */
function fit(base: string, theme: string, suffix: string): string | null {
  const room = MAX_BARTER_CODE_LENGTH - theme.length - suffix.length;
  if (room < MIN_NAME_LENGTH) return null;
  return `${base.slice(0, room)}${theme}${suffix}`;
}

/**
 * Every code to try, best first, deterministic for a given start index:
 * 1) NAME + each theme word (starting at `startIndex`, wrapping),
 * 2) then NAME + theme + a number 2..99 without a 0 (0 looks like O), never random letters.
 */
export function barterCodeCandidates(base: string, startIndex = 0): string[] {
  const themes = THEME_WORDS.map((_, i) => THEME_WORDS[(i + startIndex + THEME_WORDS.length * 4) % THEME_WORDS.length]);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (c: string | null) => {
    if (c && isValidBarterCode(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  };
  for (const t of themes) push(fit(base, t, ""));
  for (let n = 2; n <= 99; n++) if (n % 10 !== 0) for (const t of themes) push(fit(base, t, String(n)));
  return out;
}

/** The first candidate not already taken, or null if every one is. `taken` is compared uppercase. */
export function pickBarterCode(base: string, taken: Set<string>, startIndex = 0): string | null {
  for (const c of barterCodeCandidates(base, startIndex)) if (!taken.has(c)) return c;
  return null;
}
