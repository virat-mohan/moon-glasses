/** Pure helpers for the tagged-post grid approval queue (no network, testable). */

export const FEED_MIN_RATIO = 4 / 5; // width / height
export const FEED_MAX_RATIO = 1.91;
export const CAPTION_MAX = 300;

export type FitDecision = { action: "keep" } | { action: "crop"; width: number; height: number };

/** Keep the photo as-is when Instagram's feed accepts its ratio; otherwise crop (never stretch) to the nearest allowed ratio. */
export function decideFit(width: number, height: number): FitDecision {
  if (!(width > 0) || !(height > 0)) throw new Error("Image has no size");
  const r = width / height;
  if (r >= FEED_MIN_RATIO - 1e-6 && r <= FEED_MAX_RATIO + 1e-6) return { action: "keep" };
  if (r < FEED_MIN_RATIO) return { action: "crop", width, height: Math.min(height, Math.floor(width / FEED_MIN_RATIO)) };
  return { action: "crop", width: Math.min(width, Math.floor(height * FEED_MAX_RATIO)), height };
}

/** `voiceBlock` returns a reason string when the caption fails brand voice (checkVoice), else null. */
export function buildGridCaption(username: string, voiceBlock?: (caption: string) => string | null): string {
  const clean = username.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
  if (!clean) throw new Error("No username to credit");
  const caption = `📸 @${clean}\n\nlight tints, good vibe.\n\n#MoonGlasses #LightTintsGoodVibe`;
  if (caption.length > CAPTION_MAX) throw new Error("Caption too long");
  const blocked = voiceBlock?.(caption);
  if (blocked) throw new Error(`Caption fails brand voice: ${blocked}`);
  return caption;
}

export type GridStatus = "posted" | "skipped" | "failed" | "posting";
export type GridMark = { status: GridStatus; postId?: string; at: string; reason?: string };

/** Which actions the row allows given its current grid_post mark. Failed rows may be retried; posted/posting never. */
export function gridClaimAllowed(current: GridMark | null | undefined, action: "post" | "skip"): boolean {
  if (!current) return true;
  if (current.status === "posted" || current.status === "posting") return false;
  if (current.status === "skipped") return action === "post"; // changed mind
  return true; // failed
}

export const gridMark = (status: GridStatus, extra: { postId?: string; reason?: string } = {}): GridMark => ({
  status,
  ...extra,
  at: new Date().toISOString(),
});
