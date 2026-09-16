import { getSetting } from "@/lib/settings";

export const RETURN_REASONS = ["defect", "wrong_size"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export function isValidReturnReason(value: unknown): value is ReturnReason {
  return typeof value === "string" && (RETURN_REASONS as readonly string[]).includes(value);
}

/** Default 3 days — configurable in /admin/settings, not hardcoded. */
export async function getReturnWindowDays() {
  const setting = await getSetting("RETURN_WINDOW_DAYS");
  return setting ? Number(setting) : 3;
}

/**
 * The window always starts from the moment Shiprocket's webhook actually
 * confirmed delivery (orders.delivered_at), never a guess from order date —
 * transit time varies a lot by address, and delivered_at is the one signal
 * that's already correct for every address without us tracking anything
 * per-pincode ourselves.
 */
export async function isWithinReturnWindow(deliveredAt: string | null): Promise<boolean> {
  if (!deliveredAt) return false;
  const windowDays = await getReturnWindowDays();
  const deadline = new Date(deliveredAt).getTime() + windowDays * 24 * 60 * 60 * 1000;
  return Date.now() <= deadline;
}

/**
 * A defect is the brand's fault — full refund, shipping included. Wrong
 * size follows the same policy as an RTO (subtotal + discount only,
 * shipping forfeited) since it's not a quality failure on our end.
 * "Changed my mind" is deliberately not a valid reason at all — see
 * isValidReturnReason / RETURN_REASONS.
 */
export function computeReturnRefundRupees(
  reason: ReturnReason,
  order: { total: number; shipping_charge?: number | null },
  alreadyRefunded: number
): number {
  const shippingCharge = order.shipping_charge ?? 0;
  const full = reason === "defect" ? order.total : order.total - shippingCharge;
  return Math.max(0, full - alreadyRefunded);
}
