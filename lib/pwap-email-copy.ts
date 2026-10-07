// Customer + team Pay With A Post email copy. Pure builders (no network) so
// the words can be checked with checkVoice in tests.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const PWAP_CONFIRM_SUBJECT = "Your Pay With A Post™ order is confirmed";

export type PwapConfirmationInput = {
  name: string;
  brandName: string;
  siteUrl: string;
  instagramHandle: string;
  orderId: string;
  codes: string[];
  salesToShip: number;
  cardUrl: string | null;
  tier: "gift_first" | "sell_first";
};

export function buildPwapConfirmationEmail(i: PwapConfirmationInput): { subject: string; html: string } {
  const site = i.siteUrl.replace(/\/$/, "");
  const logoUrl = `${site}/images/brand/moon-glasses-logo.png`;
  const privateUrl = `${site}/barter/${i.orderId}`;
  const firstName = esc((i.name ?? "").trim().split(/\s+/)[0] || "there");
  const n = i.salesToShip;
  const codeLabel = i.codes.length === 1 ? "Your code" : "Your codes";
  const steps =
    i.tier === "gift_first"
      ? `
        <li>Your pair is on its way, nothing to wait for.</li>
        <li>Once it arrives, wear it and post a photo or reel.</li>
        <li>Add ${esc(i.instagramHandle)} as a collaborator, and share your code so friends can order.</li>`
      : `
        <li>Post the image below on Instagram (feed or story) and add ${esc(i.instagramHandle)} as a collaborator.</li>
        <li>Friends order with your code.</li>
        <li>${n} sales on your code and your pair ships free.</li>`;
  const intro = i.tier === "gift_first" ? "Your order is confirmed and shipping now. Here is what happens next." : "Your order is confirmed. Here is what happens next.";
  const codesHtml = i.codes
    .map((c) => `<span style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;background:#f0eee4;border:1px dashed #101820;font-size:17px;font-weight:bold;letter-spacing:0.06em;">${esc(c)}</span>`)
    .join("");
  const html = `
    <div style="max-width:480px;margin:0 auto;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:0 24px;">
      <div style="padding:16px 0;text-align:center;">
        <img src="${logoUrl}" alt="${esc(i.brandName)}" width="100" height="50" style="display:inline-block;" />
      </div>
      <p style="font-size:16px;">Hi ${firstName},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;">${intro}</p>
      <ol style="font-size:14px;color:#444;line-height:1.8;padding-left:20px;">${steps}</ol>
      <p style="margin:16px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#666;">${codeLabel}</p>
      <div>${codesHtml}</div>
      ${i.cardUrl ? `<img src="${esc(i.cardUrl)}" alt="Your post" width="432" style="display:block;width:100%;max-width:432px;height:auto;margin:16px 0;" />` : ""}
      <a href="${privateUrl}" style="display:inline-block;margin-top:8px;padding:14px 28px;background:#e7c77a;color:#000000;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;font-size:14px;">Open your private page</a>
      <p style="margin-top:14px;font-size:13px;color:#444;line-height:1.5;">Sign in with this email address; we'll send a one-time code. Don't forward this email.</p>
      <p style="margin-top:24px;font-size:12px;color:#999;">${esc(i.brandName)} · Light tints, good vibes</p>
    </div>`;
  return { subject: PWAP_CONFIRM_SUBJECT, html };
}

export type PwapTeamEmailInput = {
  orderNumber: string;
  customerFirstName: string;
  items: { name: string; quantity: number }[];
  code: string;
  salesToShip: number;
  adminUrl: string;
  isTier: "gift_first" | "sell_first";
};

export function buildPwapTeamEmailBody(i: PwapTeamEmailInput): string {
  const items = i.items.map((it) => `<li>${it.quantity} × ${esc(it.name)}</li>`).join("");
  const status = i.isTier === "gift_first" ? "Ship first: ships now on trust." : `Waiting for sales (0 of ${i.salesToShip}). <strong>Do NOT ship.</strong>`;
  return `
    <div style="max-width:480px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="font-size:15px;margin:6px 0;"><strong>New Pay With A Post order #${esc(i.orderNumber)}</strong></p>
      <p style="font-size:15px;margin:6px 0;">Customer: ${esc(i.customerFirstName)}</p>
      <ul style="font-size:14px;padding-left:20px;">${items}</ul>
      <p style="font-size:15px;margin:6px 0;">Code: <strong>${esc(i.code)}</strong></p>
      <p style="font-size:15px;margin:6px 0;">Status: ${status}</p>
      <p style="font-size:13px;"><a href="${esc(i.adminUrl)}">Open orders in admin</a></p>
    </div>`;
}

/** Sign-in and kit page copy, kept here so tests can run checkVoice over every line. */
export const BARTER_PAGE_COPY = {
  signInTitle: "Your private page",
  signInIntro: "Enter the email you used at checkout. We'll send a one-time code.",
  sendCode: "Send my code",
  codeLabel: "6-digit code",
  openPage: "Open my page",
  sending: "sending…",
  checking: "checking…",
  wrongCode: "that code is wrong or has expired. try again, or ask for a new one.",
  tagline: "Light tints, good vibes",
  anotherPost: "Get another post",
  makingAnother: "making your next post…",
  capReached: "you've made the most posts one order allows.",
  anotherError: "couldn't make another post just now. try again in a moment.",
  copyCode: "Copy code",
  copied: "Code copied",
  legacyNote: "This is an older order, so the page stays open. Your private sign-in comes with your next order.",
} as const;
