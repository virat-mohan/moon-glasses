import { getSetting } from "@/lib/settings";
import { renderInvoiceHtml } from "@/lib/invoice";
import { getBrandProfile } from "@/lib/brand";

type InvoiceOrder = Parameters<typeof renderInvoiceHtml>[0];
type InvoiceItem = Parameters<typeof renderInvoiceHtml>[1][number];

/**
 * Wraps a body fragment in a full HTML document forcing light-mode
 * rendering — without the explicit color-scheme meta tags, Apple/iOS Mail's
 * automatic dark-mode inversion flips black text/logos to white.
 */
function wrapEmailHtml(bodyHtml: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
</head>
<body style="background-color:#ffffff;margin:0;padding:24px 0;">
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Low-level send — every other function in this file (and lib/newsletter.ts)
 * goes through this one. Resend, not Brevo: one shared Retail-OS-wide Resend
 * account handles every brand's transactional mail, each brand as its own
 * verified sending domain — onboarding a new brand is one DNS record, not a
 * new account. RESEND_API_KEY is the same key across every Retail OS
 * project; only the sender domain/name below is brand-specific.
 */
export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  attachments?: { url: string; name: string }[],
  /** Optional plain-text alternative, shown by clients that don't render HTML. */
  options?: { text?: string }
) {
  const apiKey = await getSetting("RESEND_API_KEY");
  if (!apiKey) {
    console.log(`RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend's API sits behind Cloudflare, which scored a bare-script
        // User-Agent (seen testing this from a Python client with no UA
        // override) as bot traffic and blocked the request outright
        // (Cloudflare error 1010) — a browser-shaped UA fixed it
        // immediately, confirmed against the live API. Node's default fetch
        // UA is unlikely to trigger this, but setting one explicitly removes
        // the doubt rather than assuming — a script-identifying UA (e.g.
        // "MoonglassesServer/1.0") risks tripping the same heuristic, so
        // this deliberately looks like an ordinary browser instead.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      body: JSON.stringify({
        from: "Moonglasses <orders@moon-glasses.store>",
        to: [to],
        subject,
        html: wrapEmailHtml(bodyHtml),
        ...(options?.text ? { text: options.text } : {}),
        // Resend fetches the file from the URL itself (same as Brevo did) —
        // no need to download and base64-encode it ourselves.
        ...(attachments && attachments.length > 0
          ? { attachments: attachments.map((a) => ({ path: a.url, filename: a.name })) }
          : {}),
      }),
    });
    if (!res.ok) {
      console.error("Resend send failed", subject, res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send failed", subject, err);
    return false;
  }
}

export async function sendInvoiceEmail(order: InvoiceOrder, items: InvoiceItem[]) {
  if (!order.customer_email) return false;
  const invoiceHtml = await renderInvoiceHtml(order, items);
  return sendEmail(
    order.customer_email,
    `Your Moonglasses Invoice — Order #${order.id.slice(0, 8).toUpperCase()}`,
    invoiceHtml
  );
}

export const ORDER_NOTIFICATION_RECIPIENTS = ["viratmohan@gmail.com", "hello@moon-glasses.store"];

/** Internal heads-up the moment an order is confirmed — same invoice, sent to the team instead of the customer. */
export async function sendOrderNotificationEmail(order: InvoiceOrder, items: InvoiceItem[]) {
  const invoiceHtml = await renderInvoiceHtml(order, items);
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  await Promise.all(
    ORDER_NOTIFICATION_RECIPIENTS.map((to) =>
      sendEmail(to, `New order confirmed — #${orderNumber}`, invoiceHtml)
    )
  );
}

/** Fires once when a Chapter's stock crosses at/under the low-stock threshold — see lib/inventory.ts for the guard against repeat alerts. */
export async function sendLowStockAlertEmail(chapterName: string, stockRemaining: number, threshold: number) {
  const html = `
    <div style="max-width:480px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="font-size:15px;">
        <strong>${chapterName}</strong> is down to <strong>${stockRemaining}</strong> unit${stockRemaining === 1 ? "" : "s"} on hand
        (threshold: ${threshold}). Time to reorder if you haven't already.
      </p>
    </div>
  `;
  await Promise.all(
    ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, `Low stock — ${chapterName} (${stockRemaining} left)`, html))
  );
}

/** Internal heads-up the moment a customer submits a photo via /community/add-your-chapter — nudges the team to review it in /admin/explorer-submissions. */
export async function sendExplorerSubmissionNotificationEmail(photoUrl: string, testimonial: string, location: string | null) {
  const html = `
    <div style="max-width:480px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="font-size:13px;color:#666;">New Explorer submission awaiting review</p>
      <img src="${photoUrl}" alt="" style="max-width:100%;margin:8px 0;" />
      <p style="font-size:15px;white-space:pre-wrap;">${testimonial}</p>
      ${location ? `<p style="font-size:13px;color:#666;">${location}</p>` : ""}
      <p style="font-size:13px;"><a href="https://moon-glasses.store/admin/explorer-submissions">Review in admin</a></p>
    </div>
  `;
  await Promise.all(
    ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, "New Explorer submission to review", html))
  );
}

/** Contact-us form submission — forwarded to the team as-is, replies go straight to the customer. */
export async function sendContactFormEmail(name: string, email: string, message: string) {
  const html = `
    <div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="font-size:13px;color:#666;">New contact form submission</p>
      <p style="font-size:15px;margin:4px 0;"><strong>Name:</strong> ${name}</p>
      <p style="font-size:15px;margin:4px 0;"><strong>Email:</strong> ${email}</p>
      <p style="font-size:15px;margin:16px 0 4px;"><strong>Message:</strong></p>
      <p style="font-size:15px;white-space:pre-wrap;">${message}</p>
    </div>
  `;
  const results = await Promise.all(
    ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, `Contact form — ${name}`, html))
  );
  return results.some(Boolean);
}

/** Login OTP by email — the active channel while WhatsApp/SMS delivery is still being set up. */
export async function sendOtpEmail(email: string, code: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;text-align:center;">
      <div style="background-color:#ffffff;padding:16px 0;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:14px;color:#666;">Your login code is</p>
      <p style="font-size:36px;font-weight:bold;letter-spacing:0.15em;margin:8px 0 24px;">${code}</p>
      <p style="font-size:13px;color:#999;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `;
  return sendEmail(email, `${code} is your ${brand.brandName} login code`, html);
}

type CartSessionForEmail = {
  customer_name: string | null;
  customer_email: string | null;
  items: { name: string; quantity: number }[];
};

/** Abandoned-cart nudge by email — mirrors sendAbandonedCartWhatsApp for customers without/before WhatsApp delivery. */
export async function sendAbandonedCartEmail(session: CartSessionForEmail) {
  if (!session.customer_email) return false;
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const cartUrl = `${brand.siteUrl.replace(/\/$/, "")}/cart`;
  const itemLines = session.items
    .map((i) => `<li style="margin-bottom:4px;">${i.quantity} × ${i.name}</li>`)
    .join("");

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi${session.customer_name ? ` ${session.customer_name}` : ""},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">You left something in your cart:</p>
      <ul style="font-size:14px;color:#1a1a1a;list-style:none;margin:0;padding:0;">${itemLines}</ul>
      <a href="${cartUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Finish Checking Out</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(session.customer_email, `You left something at ${brand.brandName}`, html);
}

/**
 * Second-stage abandoned-cart nudge by email, carrying the BUYNOW10 coupon —
 * mirrors sendBuyNow10WhatsApp for customers without/before WhatsApp
 * delivery. Also carries one-click "why didn't you buy" reason links, so a
 * customer who isn't converting can tell us why with a single tap — no
 * reply/login needed. See /api/cart-feedback for what handles the click.
 */
export async function sendBuyNow10Email(
  session: CartSessionForEmail,
  couponCode: string,
  cartSessionId: string
) {
  if (!session.customer_email) return false;
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const cartUrl = `${brand.siteUrl.replace(/\/$/, "")}/cart`;
  const feedbackUrl = `${brand.siteUrl.replace(/\/$/, "")}/api/cart-feedback?session=${cartSessionId}`;
  const itemLines = session.items
    .map((i) => `<li style="margin-bottom:4px;">${i.quantity} × ${i.name}</li>`)
    .join("");
  const reasonLink = (reason: string, label: string) =>
    `<a href="${feedbackUrl}&reason=${reason}" style="display:block;color:#101820;text-decoration:underline;font-size:15px;line-height:1.8;margin-bottom:10px;">&bull;&nbsp;&nbsp;${label}</a>`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi${session.customer_name ? ` ${session.customer_name}` : ""},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">Still thinking it over? Here's 10% off to help you decide:</p>
      <p style="margin:16px 0;padding:12px 20px;background:#f0eee4;border:1px dashed #101820;display:inline-block;font-size:18px;font-weight:bold;letter-spacing:0.08em;">${couponCode}</p>
      <ul style="font-size:14px;color:#1a1a1a;list-style:none;margin:0;padding:0;">${itemLines}</ul>
      <a href="${cartUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Use Code &amp; Check Out</a>
      <p style="margin-top:32px;margin-bottom:14px;font-size:14px;color:#666;">Didn't get a chance to buy? Tell us why — takes one click:</p>
      <div>
        ${reasonLink("price", "Price felt too high")}
        ${reasonLink("designs", "Wasn't excited about the designs")}
        ${reasonLink("technical", "Ran into a technical/website issue")}
        ${reasonLink("later", "Just planning to buy later")}
        ${reasonLink("other", "Something else")}
      </div>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(session.customer_email, `MOON GLASSES | 10% off on what's still in your cart`, html);
}

/** Sent once to each pending "notify me" lead when a sold-out Chapter's stock goes back above zero. */
export async function sendRestockEmail(email: string, name: string | null, chapterName: string, chapterSlug: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const chapterUrl = `${brand.siteUrl.replace(/\/$/, "")}/chapter/${chapterSlug}`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">${chapterName} is back in stock — grab it before it sells out again.</p>
      <a href="${chapterUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop ${chapterName}</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(email, `${chapterName} is back in stock`, html);
}

/** Sent right after a successful ₹{amount} pre-order deposit — reassurance + a reminder of when the drop actually goes live. */
export async function sendPreorderConfirmationEmail(
  email: string,
  name: string,
  amountRupees: number,
  dropDateLabel: string
) {
  const brand = await getBrandProfile();
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">You're on the list, ${name}.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your ₹${amountRupees.toLocaleString("en-IN")} pre-order deposit is confirmed. The full collection
        drops <strong>${dropDateLabel}</strong> — you'll get first access and an email the second it's live,
        before it opens to everyone else.
      </p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your ₹${amountRupees.toLocaleString("en-IN")} is credited toward whatever you order at the drop.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(email, `You're in — ${brand.brandName} drops ${dropDateLabel}`, html);
}

/** Sent to every paid pre-order once the admin flips the "Notify All" switch at drop time. */
export async function sendDropLiveEmail(email: string, name: string) {
  const brand = await getBrandProfile();
  const siteUrl = brand.siteUrl.replace(/\/$/, "");
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">It's live, ${name}.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        The full collection just dropped — you get first access before everyone else. Your deposit is
        already credited at checkout.
      </p>
      <a href="${siteUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop Now</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(email, `${brand.brandName} just dropped — shop now`, html);
}

/** Sent immediately when a customer invites a friend from their account page. */
export async function sendReferralInviteEmail(
  toEmail: string,
  toName: string | null,
  referrerName: string | null,
  referralCode: string,
  discountRupees: number
) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const referralUrl = `${brand.siteUrl.replace(/\/$/, "")}/?ref=${referralCode}`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${toName ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        ${referrerName ?? "A friend"} thinks you&apos;d like ${brand.brandName} — fashion-forward
        sunglasses, ₹1,499 acetate / ₹1,999 metal. Use their link and get ₹${discountRupees} off your first order.
      </p>
      <a href="${referralUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop &amp; Save ₹${discountRupees}</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `${referrerName ?? "A friend"} gave you ₹${discountRupees} off ${brand.brandName}`, html);
}

/** Sent once, when an order's shipment status transitions to delivered — see the courier-status webhook. */
export async function sendReviewRequestEmail(
  toEmail: string,
  customerName: string | null,
  orderId: string,
  chapterNames: string[]
) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const googleReviewUrl = "https://g.page/r/CbvWdBDo1oxlEBM/review";
  const returnUrl = `${brand.siteUrl.replace(/\/$/, "")}/return/${orderId}`;
  const itemsLine = chapterNames.join(", ");

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${customerName ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your ${itemsLine} should have arrived by now — how is it? A quick review helps other
        travellers pick the right Chapter, and takes under a minute.
      </p>
      <a href="${googleReviewUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Leave a Review</a>
      <p style="margin-top:20px;font-size:13px;color:#666;">
        Something wrong with it? <a href="${returnUrl}" style="color:#101820;">Request a return</a>.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `How's your ${brand.brandName}?`, html);
}

/** Retention nudge for a customer who hasn't ordered in a while — see the win-back cron. */
export async function sendWinbackEmail(toEmail: string, name: string | null, milesBalance: number) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const shopUrl = `${brand.siteUrl.replace(/\/$/, "")}/series`;

  const milesLine =
    milesBalance > 0
      ? `You've still got ${milesBalance.toLocaleString("en-IN")} Moonglasses Good Vibes sitting there, ready to redeem.`
      : "There are new Chapters up since you last checked in.";

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">It's been a while — ${milesLine}</p>
      <a href="${shopUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Shop the Collection</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `We miss you at ${brand.brandName}`, html);
}

/** Sent when a shipment enters an RTO-in-transit status — informational, fires alongside the WhatsApp nudge since it needs no template approval. */
export async function sendRtoInitiatedEmail(toEmail: string, name: string | null, orderId: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Unfortunately delivery couldn't be completed for order #${orderId.slice(0, 8).toUpperCase()},
        and it's on its way back to us. Once it arrives, we'll refund you in full (minus the original
        shipping charge) — no action needed from you.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Your order is on its way back to us`, html);
}

/** Sent once an RTO'd item is physically back and the refund has actually gone through. */
export async function sendRtoRefundedEmail(toEmail: string, name: string | null, orderId: string, refundRupees: number) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        We've received order #${orderId.slice(0, 8).toUpperCase()} back and refunded
        <strong>₹${refundRupees.toLocaleString("en-IN")}</strong> to your original payment method —
        it should reflect within 5-7 business days.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Refunded — order #${orderId.slice(0, 8).toUpperCase()}`, html);
}

/** Sent when an admin approves a return request and schedules the pickup. */
export async function sendReturnApprovedEmail(toEmail: string, name: string | null, orderId: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your return for order #${orderId.slice(0, 8).toUpperCase()} is approved — a courier will
        be in touch to pick it up. Once we receive it, we'll refund you and confirm by email.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Return approved — order #${orderId.slice(0, 8).toUpperCase()}`, html);
}

/** Sent when an admin denies a return request. */
export async function sendReturnDeniedEmail(toEmail: string, name: string | null, orderId: string, reason: string) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        We've reviewed your return request for order #${orderId.slice(0, 8).toUpperCase()} and
        aren't able to approve it: ${reason}. Reply to this email if you'd like to discuss it further.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Update on your return — order #${orderId.slice(0, 8).toUpperCase()}`, html);
}

/** Sent once a customer-initiated return is physically back and refunded — same trigger point as the RTO-refunded email, different copy. */
export async function sendReturnRefundedEmail(toEmail: string, name: string | null, orderId: string, refundRupees: number) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name ?? "there"},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        We've received your return for order #${orderId.slice(0, 8).toUpperCase()} and refunded
        <strong>₹${refundRupees.toLocaleString("en-IN")}</strong> to your original payment method —
        it should reflect within 5-7 business days.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Return refunded — order #${orderId.slice(0, 8).toUpperCase()}`, html);
}

/**
 * Fires the moment an order is shipped and a courier/AWB is assigned —
 * tells the warehouse manager what to pack and ship. Includes the full
 * invoice inline (same renderInvoiceHtml the customer/admin invoice page
 * uses) and attaches the actual Shiprocket shipping label PDF (barcode +
 * AWB), not just a link to it, so the warehouse can print directly from
 * the email. Best-effort: WAREHOUSE_EMAIL being unset, or the label PDF
 * not being ready yet, must never fail the Ship action itself — the
 * caller (the ship route) already treats this as non-blocking.
 */
export async function sendWarehouseNotificationEmail(
  order: InvoiceOrder & {
    id: string;
    customer_phone: string;
    shiprocket_awb_code: string | null;
    courier_name: string | null;
  },
  items: InvoiceItem[],
  labelUrl: string | null
) {
  const warehouseEmailSetting = await getSetting("WAREHOUSE_EMAIL");
  if (!warehouseEmailSetting) return false;
  // Comma-separated so more than one person (e.g. the warehouse manager and
  // an admin) can be notified without needing separate settings.
  const recipients = warehouseEmailSetting
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const brand = await getBrandProfile();
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const invoiceHtml = await renderInvoiceHtml(order, items);

  const itemLines = items
    .map((item) => `<li style="margin-bottom:4px;">${item.quantity} × ${item.chapter_name}</li>`)
    .join("");

  const html = `
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <h2 style="font-size:20px;">New order to pack — #${orderNumber}</h2>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        ${order.customer_name} · ${order.customer_phone}<br/>
        ${order.delivery_address}${order.delivery_city ? `, ${order.delivery_city}` : ""}${order.delivery_state ? `, ${order.delivery_state}` : ""}${order.delivery_pincode ? ` — ${order.delivery_pincode}` : ""}
      </p>
      <ul style="font-size:14px;color:#1a1a1a;padding-left:20px;">${itemLines}</ul>
      <p style="font-size:14px;color:#444;">
        Courier: <strong>${order.courier_name ?? "assigned"}</strong> · AWB: <strong>${order.shiprocket_awb_code ?? "pending"}</strong>
      </p>
      ${
        labelUrl
          ? `<p style="font-size:13px;color:#666;">Shipping label is attached to this email, and also available at <a href="${labelUrl}">${labelUrl}</a>.</p>`
          : `<p style="font-size:13px;color:#b8492f;">Label wasn't ready yet when this email sent — check the order in Shiprocket directly.</p>`
      }
      <div style="margin-top:24px;border-top:1px solid #ddd;padding-top:16px;">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999;margin-bottom:8px;">Invoice</p>
        ${invoiceHtml}
      </div>
      <p style="margin-top:24px;font-size:12px;color:#999;">${brand.brandName} · Internal warehouse notification</p>
    </div>
  `;

  const attachments = labelUrl ? [{ url: labelUrl, name: `label-${orderNumber}.pdf` }] : undefined;
  const results = await Promise.all(
    recipients.map((recipient) =>
      sendEmail(recipient, `Ship this — Order #${orderNumber}`, html, attachments)
    )
  );
  return results.every(Boolean);
}

/** Sent the moment a creator submits the /creator/apply form — confirms it was received, sets expectations, no promises either way. */
export async function sendCreatorApplicationReceivedEmail(toEmail: string, name: string) {
  const brand = await getBrandProfile();
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">Thanks, ${name}.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your creator application is in. We review every application by hand — if it's a fit,
        we'll be in touch by email or WhatsApp with next steps.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `We've got your ${brand.brandName} creator application`, html);
}

/** Internal heads-up the moment a new creator application lands, with the agent's score/recommendation so review starts pre-triaged. */
export async function sendCreatorApplicationNotificationEmail(
  name: string,
  instagramHandle: string,
  followerCount: number,
  score: number,
  recommendation: string
) {
  const html = `
    <div style="max-width:480px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="font-size:13px;color:#666;">New creator application</p>
      <p style="font-size:15px;"><strong>${name}</strong> · @${instagramHandle.replace(/^@/, "")} · ${followerCount.toLocaleString("en-IN")} followers</p>
      <p style="font-size:14px;">Agent score: <strong>${score}/100</strong> — recommend <strong>${recommendation.toUpperCase()}</strong></p>
      <p style="font-size:13px;"><a href="https://moon-glasses.store/admin/creators">Review in admin</a></p>
    </div>
  `;
  await Promise.all(ORDER_NOTIFICATION_RECIPIENTS.map((to) => sendEmail(to, `New creator application — ${name}`, html)));
}

/** Sent when an admin approves a creator — carries the link to review and sign the collaboration agreement. */
export async function sendCreatorApprovedEmail(toEmail: string, name: string, agreementUrl: string) {
  const brand = await getBrandProfile();
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">You're in, ${name}.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Welcome to the ${brand.brandName} creator community. One last step before we ship your product —
        please review and sign the short collaboration agreement.
      </p>
      <a href="${agreementUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Review &amp; Sign</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `You're approved — sign your ${brand.brandName} creator agreement`, html);
}

/** Sent when an admin rejects a creator application. */
export async function sendCreatorRejectedEmail(toEmail: string, name: string) {
  const brand = await getBrandProfile();
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="font-size:16px;">Hi ${name},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Thanks for applying to the ${brand.brandName} creator program — we're not able to move forward
        with it right now, but we'd love to see future applications as the program grows.
      </p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Update on your ${brand.brandName} creator application`, html);
}

/** Sent the moment a "Pay With A Post" order is placed — hands over the shareable code and explains what has to happen before it ships. */
export async function sendPostBarterOrderConfirmationEmail(
  toEmail: string,
  name: string,
  orderId: string,
  couponCode: string,
  requiredOrders: number,
  tier: "gift_first" | "sell_first"
) {
  const brand = await getBrandProfile();
  const logoUrl = `${brand.siteUrl.replace(/\/$/, "")}/images/brand/moon-glasses-logo.png`;
  const instagramProfileUrl = `https://instagram.com/${brand.instagramHandle.replace(/^@/, "")}`;
  const trackingUrl = `${brand.siteUrl.replace(/\/$/, "")}/barter/${orderId}`;

  const steps =
    tier === "gift_first"
      ? `
        <li>It's on its way — no need to wait for anything.</li>
        <li>Once it arrives, wear it and take a photo or Reel.</li>
        <li>Post it on Instagram and add <a href="${instagramProfileUrl}" style="color:#101820;">${brand.instagramHandle}</a> as a collaborator (or tag us if collaborator invites aren't available to you).</li>
      `
      : `
        <li>Share it your way — feed post or Story, whichever you're confident can get you ${requiredOrders} buyers. Add <a href="${instagramProfileUrl}" style="color:#101820;">${brand.instagramHandle}</a> as a collaborator or tag us.</li>
        <li>Share your code below with your followers — anyone who checks out with it counts toward your goal.</li>
        <li>Once <strong>${requiredOrders}</strong> people check out with it, we ship your order automatically — free.</li>
      `;
  const intro =
    tier === "gift_first"
      ? "Your order is confirmed and shipping now — here's what happens next:"
      : "Your order is confirmed. Here's what happens next:";

  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="background-color:#ffffff;padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${brand.brandName}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${name},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">${intro}</p>
      <ol style="font-size:14px;color:#444;line-height:1.8;padding-left:20px;">${steps}</ol>
      <p style="margin:16px 0;padding:12px 20px;background:#f0eee4;border:1px dashed #101820;display:inline-block;font-size:18px;font-weight:bold;letter-spacing:0.08em;">${couponCode}</p>
      <a href="${trackingUrl}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">${tier === "gift_first" ? "View Details" : "Track Your Progress"}</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `You're in — here's your ${brand.brandName} code`, html);
}

/** Sent the moment a "Pay With A Post" order clears its required-orders line and actually ships. */
export async function sendPostBarterQualifiedEmail(toEmail: string, phone: string) {
  const brand = await getBrandProfile();
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">Your Good Vibes Came Through.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your network showed up for you — your order is shipping now, completely free. We'll follow up
        on WhatsApp (${phone}) with tracking.
      </p>
      <a href="${brand.siteUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Spread More Good Vibes — Shop Another Pair</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Good Vibes delivered — it's shipping`, html);
}

/** Sent to the barterer every time a NEW, real (non-self) redemption lands on their code, before they've hit the required-orders line — so the loop feels alive instead of silent until it's suddenly done. */
export async function sendPostBarterProgressEmail(toEmail: string, ordersSoFar: number, required: number) {
  const brand = await getBrandProfile();
  const remaining = Math.max(0, required - ordersSoFar);
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">Good Vibes Are Building.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Someone just shopped with your code — that's <strong>${ordersSoFar} of ${required}</strong>.
        You're <strong>${remaining} Good Vibe${remaining === 1 ? "" : "s"} away</strong> from your free
        pair shipping automatically.
      </p>
      <div style="margin:20px 0;height:8px;width:100%;max-width:280px;background:#f0eee4;border-radius:999px;overflow:hidden;">
        <div style="height:8px;width:${Math.min(100, Math.round((ordersSoFar / required) * 100))}%;background:#101820;"></div>
      </div>
      <p style="font-size:14px;color:#444;line-height:1.6;">Keep sharing your code — the Good Vibes are almost there.</p>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `${ordersSoFar}/${required} — you're getting close`, html);
}

/** Sent once by app/api/cron/barter-charge-sweep when a gift_first order's 12-hour post-after-delivery deadline (accepted at checkout) passes with no post link submitted. */
export async function sendBarterChargeLinkEmail(toEmail: string, name: string, orderId: string, amountRupees: number) {
  const brand = await getBrandProfile();
  const payUrl = `${brand.siteUrl.replace(/\/$/, "")}/barter/${orderId}/pay`;
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">The 12-Hour Window Has Passed.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">Hi ${name},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Your order shipped on trust, and the 12-hour window to post about it after delivery — agreed to at
        checkout — has passed without a post link submitted. As agreed, here's the payment link for the
        full order value of <strong>₹${amountRupees.toLocaleString("en-IN")}</strong>.
      </p>
      <p style="font-size:14px;color:#444;line-height:1.6;">
        Already posted, or about to? Drop the link on your order page instead and this charge won't go
        through.
      </p>
      <a href="${payUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Pay Now</a>
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Payment needed — the 12-hour window has passed`, html);
}

/** Sent right after a creator signs their agreement — confirms it, hands over their tracking/discount code. */
export async function sendCreatorAgreementSignedEmail(toEmail: string, name: string, couponCode: string | null) {
  const brand = await getBrandProfile();
  const couponLine = couponCode
    ? `<p style="font-size:14px;color:#444;line-height:1.6;">Your creator code is <strong>${couponCode}</strong> — share it so anyone who buys through you gets a discount and we can track what your content drives.</p>`
    : "";
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:#666;">${brand.brandName}</p>
      <h1 style="font-size:22px;margin:24px 0 8px;">Agreement signed, ${name}.</h1>
      <p style="font-size:14px;color:#444;line-height:1.6;">We'll ship your product shortly and follow up with tracking.</p>
      ${couponLine}
      <p style="margin-top:32px;font-size:12px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
  return sendEmail(toEmail, `Agreement signed — welcome to ${brand.brandName}`, html);
}
