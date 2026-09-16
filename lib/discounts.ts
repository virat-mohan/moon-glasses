export type DiscountRule = {
  id: string;
  name: string;
  buyQuantity: number;
  discountPercent: number;
};

/**
 * A short, shopper-facing line for the active rule — used everywhere the
 * offer needs to be announced (homepage, product pages, cart) before the
 * per-cart discount math in calculateDiscount ever runs. When the rule is
 * a 100%-off, it's purely "Buy N, Get 1 Free" — no percent-off language
 * mixed in, since that reads as a second, contradictory offer rather than
 * a plainer description of the same one.
 *
 * buyQuantity is the calculation engine's GROUP size, not the paid count —
 * "buy 3, get the 4th free" is buyQuantity 4 (a group of 4 units; the
 * cheapest of the 4 is the free one) with discountPercent 100. Set up that
 * exact rule in /admin/discounts as buy=4, cheapest-at=100% off.
 */
export function describeDiscountRule(rule: DiscountRule): string {
  const paidCount = rule.buyQuantity - 1;
  if (rule.discountPercent >= 100 && paidCount >= 1) {
    return `Buy ${paidCount} Get 1 Free`;
  }
  return `Buy ${rule.buyQuantity}, Cheapest At ${rule.discountPercent}% Off`;
}

/**
 * "Buy N, cheapest one at X% off" — sort every unit in the cart by price
 * descending, then every Nth unit (the cheapest in each group of N) gets
 * discountPercent off. Generalizes "buy 2 get 3rd at half price" (N=3, 50%).
 */
export function calculateDiscount(
  items: { price: number; quantity: number }[],
  rule: DiscountRule | null
): number {
  if (!rule || rule.buyQuantity < 2) return 0;

  const units = items.flatMap((item) => Array(item.quantity).fill(item.price));
  units.sort((a, b) => b - a);

  let discount = 0;
  for (let i = rule.buyQuantity - 1; i < units.length; i += rule.buyQuantity) {
    discount += Math.round((units[i] * rule.discountPercent) / 100);
  }
  return discount;
}
