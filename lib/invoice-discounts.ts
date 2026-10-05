/**
 * The discount lines an invoice prints. An order records each kind of
 * discount in its own column (rule discount, coupon code, referral code,
 * Good Vibes), so the invoice must read all of them, not just
 * `discount_amount` (which is the automatic rule discount only). Amounts can
 * arrive as numeric strings from the database.
 */
export type InvoiceDiscountSource = {
  discount_amount?: number | string | null;
  coupon_code_used?: string | null;
  coupon_discount_amount?: number | string | null;
  referral_discount_amount?: number | string | null;
  loyalty_discount_amount?: number | string | null;
};

export type InvoiceDiscountLine = { label: string; amount: number };

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** Only the characters a code can have, so a code can never inject markup into the invoice HTML. */
const safeCode = (c: string) => c.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase().slice(0, 40);

export function invoiceDiscountLines(order: InvoiceDiscountSource): InvoiceDiscountLine[] {
  const lines: InvoiceDiscountLine[] = [];
  const rule = num(order.discount_amount);
  if (rule) lines.push({ label: "Offer discount", amount: rule });
  const coupon = num(order.coupon_discount_amount);
  if (coupon) {
    const code = order.coupon_code_used ? safeCode(order.coupon_code_used) : "";
    lines.push({ label: code ? `Discount code ${code}` : "Discount code", amount: coupon });
  }
  const referral = num(order.referral_discount_amount);
  if (referral) lines.push({ label: "Referral code", amount: referral });
  const loyalty = num(order.loyalty_discount_amount);
  if (loyalty) lines.push({ label: "Good Vibes redeemed", amount: loyalty });
  return lines;
}

/**
 * Good Vibes are earned only on orders paid for with money. Pay With A Post
 * orders and ₹0 orders (free codes) earn none (see earnMilesForOrder and
 * /pay-with-a-post/terms), so the invoice must not promise them.
 */
export function orderEarnsGoodVibes(order: { total: number | string; is_post_barter?: boolean | null }): boolean {
  return !order.is_post_barter && Number(order.total) > 0;
}
