import { getBrandProfile } from "@/lib/brand";
import { getSetting } from "@/lib/settings";
import { getOrCreateReferralCode } from "@/lib/referrals";

type InvoiceOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  delivery_address: string;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_pincode?: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_charge?: number;
  total: number;
  payment_type?: string;
  cod_advance_amount?: number;
  balance_due?: number;
  customer_id?: string | null;
};

type InvoiceItem = { chapter_name: string; unit_price: number; quantity: number };

/**
 * Table-based layout throughout, not flexbox — Outlook/older mail clients
 * don't reliably support flex, and a collapsed flex row is exactly what
 * makes borders look like they're "cutting through" text instead of sitting
 * cleanly above/below it. Every section gets real horizontal padding via
 * the outer <td>, so nothing (dividers, table rules, item rows) ever runs
 * flush to the card edge.
 */
export async function renderInvoiceHtml(order: InvoiceOrder, items: InvoiceItem[]) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moonglasses-logo-mono-white.png`;

  const date = new Date(order.created_at).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const fullAddress = [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_pincode]
    .filter(Boolean)
    .join(", ");

  const capsBought = items.reduce((sum, item) => sum + item.quantity, 0);
  const milesPerCapSetting = await getSetting("MILES_PER_CAP");
  const milesPerCap = milesPerCapSetting ? Number(milesPerCapSetting) : 250;
  const milesEarned = capsBought * milesPerCap;

  const CARD_BG = "#0d0d0d";
  const PANEL_BG = "#161616";
  const BORDER = "#2a2a2a";
  const MUTED = "#9a9a9a";
  const GOLD = "#e0b84a";

  const row = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => `
    <tr>
      <td style="padding:5px 0;font-size:14px;color:${opts.color ?? (opts.bold ? "#ffffff" : "#e5e5e5")};font-weight:${opts.bold ? "700" : "400"};">${label}</td>
      <td style="padding:5px 0;font-size:${opts.bold ? "16px" : "14px"};color:${opts.color ?? (opts.bold ? "#ffffff" : "#e5e5e5")};font-weight:${opts.bold ? "700" : "400"};text-align:right;">${value}</td>
    </tr>`;

  // Every order now has a customer record behind it (guest checkout gets
  // one too, see findOrCreateCustomerForGuest) — invoice is the one
  // touchpoint every customer reads, so it's the natural place to plant
  // the referral code even for someone who never visits /account.
  let referralSection = "";
  if (order.customer_id) {
    const [referralCode, discountSetting] = await Promise.all([
      getOrCreateReferralCode(order.customer_id),
      getSetting("REFERRAL_DISCOUNT_RUPEES"),
    ]);
    const discountRupees = discountSetting ? Number(discountSetting) : 200;
    referralSection = `
      <tr>
        <td style="padding:28px 40px 0 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PANEL_BG};border:1px solid ${BORDER};border-radius:8px;">
            <tr>
              <td style="padding:20px 24px;text-align:center;">
                <p style="margin:0;font-size:13px;color:${MUTED};">Know someone who'd love ${brand.brandName}?</p>
                <p style="margin:8px 0 0;font-size:13px;color:#e5e5e5;">Share your code — they get ₹${discountRupees} off, and you earn Miles when they buy.</p>
                <p style="margin:12px 0 0;display:inline-block;padding:8px 20px;border:1px solid ${GOLD};border-radius:4px;font-size:15px;letter-spacing:0.12em;color:${GOLD};font-weight:700;">${referralCode}</p>
                <p style="margin:12px 0 0;font-size:11px;color:#6a6a6a;">Terms and conditions apply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#e5e5e5;border-bottom:1px solid ${BORDER};">Trucker Cap — ${item.chapter_name}</td>
          <td style="padding:10px 0;font-size:14px;color:${MUTED};text-align:center;border-bottom:1px solid ${BORDER};">${item.quantity}</td>
          <td style="padding:10px 0;font-size:14px;color:${MUTED};text-align:right;border-bottom:1px solid ${BORDER};">₹${item.unit_price.toLocaleString("en-IN")}</td>
          <td style="padding:10px 0;font-size:14px;color:#e5e5e5;text-align:right;border-bottom:1px solid ${BORDER};">₹${(item.unit_price * item.quantity).toLocaleString("en-IN")}</td>
        </tr>`
    )
    .join("");

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CARD_BG};">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;font-family:Helvetica,Arial,sans-serif;color:#e5e5e5;overflow:hidden;">

          <tr>
            <td style="padding:36px 40px 8px 40px;text-align:center;">
              <img src="${logoUrl}" alt="${brand.brandName}" width="150" style="display:inline-block;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 28px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">Order #${order.id.slice(0, 8).toUpperCase()} · ${date}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr>
                    <th align="left" style="padding-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};border-bottom:1px solid ${BORDER};font-weight:600;">Item</th>
                    <th align="center" style="padding-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};border-bottom:1px solid ${BORDER};font-weight:600;">Qty</th>
                    <th align="right" style="padding-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};border-bottom:1px solid ${BORDER};font-weight:600;">Price</th>
                    <th align="right" style="padding-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};border-bottom:1px solid ${BORDER};font-weight:600;">Total</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PANEL_BG};border:1px solid ${BORDER};border-radius:8px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${row("Subtotal", `₹${order.subtotal.toLocaleString("en-IN")}`)}
                      ${order.discount_amount > 0 ? row("Discount", `−₹${order.discount_amount.toLocaleString("en-IN")}`, { color: GOLD }) : ""}
                      ${order.shipping_charge ? row("Shipping", `₹${order.shipping_charge.toLocaleString("en-IN")}`) : ""}
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid ${BORDER};">
                      <tr><td colspan="2" style="padding-top:10px;"></td></tr>
                      ${row("Total", `₹${order.total.toLocaleString("en-IN")}`, { bold: true })}
                    </table>
                    ${
                      order.payment_type === "cod_advance"
                        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
                             ${row("Paid now", `₹${(order.cod_advance_amount ?? 0).toLocaleString("en-IN")}`)}
                             ${row("Due on delivery", `₹${(order.balance_due ?? 0).toLocaleString("en-IN")}`, { bold: true, color: GOLD })}
                           </table>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#e5e5e5;">You earned <strong style="color:${GOLD};">${milesEarned} Moonglasses Miles</strong> on this order.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};">
                <tr><td style="padding-top:20px;font-size:13px;color:${MUTED};line-height:1.6;">
                  <strong style="color:#e5e5e5;">Billed to</strong><br />${order.customer_name}<br /><br />
                  <strong style="color:#e5e5e5;">Delivery address</strong><br />${fullAddress}
                </td></tr>
              </table>
            </td>
          </tr>

          ${referralSection}

          <tr>
            <td style="padding:28px 40px 0 40px;text-align:center;">
              <a href="${brand.siteUrl}" style="display:inline-block;padding:12px 28px;border:1px solid #e5e5e5;border-radius:4px;color:#e5e5e5;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Visit ${brand.brandName} &amp; Shop More</a>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};">
                <tr><td style="padding-top:18px;font-size:11px;color:#6a6a6a;line-height:1.7;text-align:center;">
                  Prices are inclusive of applicable GST.<br />
                  Moonglasses · GSTIN — add in Admin Settings<br />
                  Delhi, India
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  `;
}
