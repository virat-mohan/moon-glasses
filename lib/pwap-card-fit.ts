// Share-card code sizing: the code must always sit inside its box.
export const CARD_BOX_WIDTH = 720;
export const CARD_BOX_BORDER = 2;
export const CARD_BOX_PADDING_X = 28;
export const CARD_MAX_FONT = 56;
export const CARD_MIN_FONT = 24;
// Wide bold capitals (W, M) run about 0.88em in this font; letter spacing is 0.1em on top.
const CHAR_WIDTH_EM = 0.88;
const SPACING_EM = 0.1;

export function codeBoxInnerWidth(): number {
  return CARD_BOX_WIDTH - 2 * CARD_BOX_BORDER - 2 * CARD_BOX_PADDING_X;
}

export function codeFontSize(chars: number, innerWidth = codeBoxInnerWidth()): number {
  const n = Math.max(1, chars);
  const size = Math.floor(innerWidth / (n * (CHAR_WIDTH_EM + SPACING_EM)));
  return Math.max(CARD_MIN_FONT, Math.min(CARD_MAX_FONT, size));
}

export function codeLetterSpacing(fontSize: number): number {
  return Math.round(fontSize * SPACING_EM * 10) / 10;
}

/** Worst-case rendered width, for tests and sanity checks. */
export function estimatedCodeWidth(chars: number, fontSize: number): number {
  return Math.ceil(chars * fontSize * (CHAR_WIDTH_EM + SPACING_EM));
}
