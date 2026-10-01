// WhatsApp click-to-chat help: one quiet line wherever something might not work.
// The number lives in one place: setting SUPPORT_WHATSAPP (admin settings),
// falling back to SUPPORT_WHATSAPP_DEFAULT. Prefill only what helps us help:
// topic, page, error, cart lines, total, order id. Never phone/email/address.

export const SUPPORT_WHATSAPP_DEFAULT = "919999277240";

export type HelpContext = {
  topic: string;
  lines?: string[];
  /** Optional override from SUPPORT_WHATSAPP; digits only are kept. */
  number?: string | null;
};

// The live SUPPORT_WHATSAPP value, set once per render by the root layout
// (SupportNumberProvider), so client pages pick it up without a fetch and a
// change to the setting moves every link at once.
let runtimeNumber: string | null = null;
export function setRuntimeSupportNumber(n: string | null | undefined) {
  if (n) runtimeNumber = n;
}

export function supportNumber(n?: string | null): string {
  const d = (n || runtimeNumber || "").replace(/\D/g, "");
  return d.length >= 10 ? d : SUPPORT_WHATSAPP_DEFAULT;
}

export function helpLink(context: HelpContext): string {
  const text = ["hi moonglasses, need a hand.", `about: ${context.topic}`, ...(context.lines ?? [])]
    .filter((l) => l && l.trim())
    .join("\n");
  return `https://wa.me/${supportNumber(context.number)}?text=${encodeURIComponent(text)}`;
}

/** Short order ref used across the app: #XXXXXXXX. */
export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** The quiet help line styling: muted caption text link. */
export const HELP_LINK_CLASS = "text-caption text-secondary-text underline-offset-4 hover:underline";
