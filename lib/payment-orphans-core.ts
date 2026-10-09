export type OrphanCredit = { status: "no_match" | "ambiguous"; payerName: string | null };
export type OrphanReport = {
  credits: OrphanCredit[];
  razorpayChecked: boolean;
  razorpayCaptures: number;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** First name only, title-cased, or null when the payer name is missing or unusable. */
export function firstName(payer: string | null | undefined): string | null {
  const w = (payer ?? "").trim().split(/\s+/)[0]?.replace(/[^A-Za-z']/g, "");
  if (!w || w.length < 2) return null;
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

export function totalOrphans(r: OrphanReport): number {
  return r.credits.length + r.razorpayCaptures;
}

/** No customer data in the subject: counts only. */
export function alertSubject(r: OrphanReport): string {
  const n = totalOrphans(r);
  return n === 0 ? "Payment check: every payment has an order" : `Payment check: ${n} payment${n === 1 ? "" : "s"} without an order`;
}

export function alertHtml(r: OrphanReport): string {
  const noMatch = r.credits.filter((c) => c.status === "no_match");
  const ambiguous = r.credits.filter((c) => c.status === "ambiguous");
  const names = (list: OrphanCredit[]) => {
    const n = list.map((c) => firstName(c.payerName)).filter((x): x is string => !!x);
    return n.length ? ` First names on the bank credit: ${esc(n.join(", "))}.` : " No payer name on the bank credit.";
  };
  const row = (label: string, count: number, note: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e6e6;font-size:14px;"><strong>${esc(label)}</strong><br /><span style="color:#666;font-size:13px;">${note}</span></td><td style="padding:10px 0;border-bottom:1px solid #e6e6e6;text-align:right;font-size:20px;font-weight:700;vertical-align:top;">${count}</td></tr>`;
  const razor = r.razorpayChecked
    ? row("Razorpay captures with no order", r.razorpayCaptures, "Money taken by Razorpay in the last 24 hours that has no matching order row.")
    : row("Razorpay captures with no order", 0, "Not checked: Razorpay keys are not set, or Razorpay did not answer.");
  return `
    <div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <h2 style="font-size:18px;margin:0 0 4px;">Moonglasses: daily payment check</h2>
      <p style="font-size:13px;color:#666;margin:0 0 16px;">Last 24 hours. Read-only: nothing was changed.</p>
      <table style="width:100%;border-collapse:collapse;">
        ${row("Bank credits with no matching order", noMatch.length, `A UPI credit arrived and no unpaid order has that exact amount.${names(noMatch)}`)}
        ${row("Bank credits matching more than one order", ambiguous.length, `Two or more unpaid orders share the amount, so nothing was confirmed.${names(ambiguous)}`)}
        ${razor}
      </table>
      <p style="font-size:13px;color:#444;margin-top:16px;">Open Admin &rarr; Orders to confirm each payment by hand. The customer is not messaged by this check.</p>
    </div>`;
}
