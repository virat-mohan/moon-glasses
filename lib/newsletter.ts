import { getSupabaseServerClient } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { getBrandProfile } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import type { JournalArticle } from "@/lib/journal";

/**
 * Applies the newsletter opt-in/out checkbox from checkout — for a logged-in
 * customer, updates their subscribed flag directly; for a guest (no
 * account), upserts/removes them from the standalone subscribers table
 * (the only place a guest's preference can live).
 */
export async function applyNewsletterOptIn(customerId: string | null, email: string | null, optIn: boolean) {
  if (!email && !customerId) return;
  const supabase = getSupabaseServerClient();

  try {
    if (customerId) {
      await supabase.from("customers").update({ newsletter_subscribed: optIn }).eq("id", customerId);
    } else if (email) {
      if (optIn) {
        await supabase.from("newsletter_subscribers").upsert({ email: email.toLowerCase() }, { onConflict: "email" });
      } else {
        await supabase.from("newsletter_subscribers").delete().eq("email", email.toLowerCase());
      }
    }
  } catch (err) {
    console.error("Failed to apply newsletter opt-in", err);
  }
}

/** Every subscribed email — guest footer signups union logged-in customers who opted in, deduplicated. */
export async function getSubscriberEmails(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const [{ data: guests }, { data: customers }] = await Promise.all([
    supabase.from("newsletter_subscribers").select("email"),
    supabase.from("customers").select("email").eq("newsletter_subscribed", true).not("email", "is", null),
  ]);

  const emails = new Set<string>();
  for (const row of guests ?? []) emails.add(row.email.toLowerCase());
  for (const row of customers ?? []) {
    if (row.email) emails.add(row.email.toLowerCase());
  }
  return [...emails];
}

function renderArticleEmailHtml(article: JournalArticle, brand: Awaited<ReturnType<typeof getBrandProfile>>) {
  // /journal/[slug] isn't linked from anywhere on the live site — every real
  // visitor reads an article through the Issue's magazine-reader experience.
  const articleUrl = `${brand.siteUrl.replace(/\/$/, "")}/journal/issue/${article.issue}?article=${article.slug}`;
  const heroUrl = article.heroImage.startsWith("/")
    ? `${brand.siteUrl.replace(/\/$/, "")}${article.heroImage}`
    : article.heroImage;

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <p style="text-align:center;text-transform:uppercase;letter-spacing:0.1em;font-size:12px;color:#666;">${brand.brandName} Journal</p>
      <img src="${heroUrl}" alt="${article.title}" width="600" style="display:block;width:100%;height:auto;margin-top:16px;" />
      <h1 style="font-size:22px;margin:24px 0 4px;">${article.title}</h1>
      <p style="color:#666;font-size:14px;margin:0 0 16px;">${article.subtitle}</p>
      <p style="font-size:14px;line-height:1.6;">${article.excerpt}</p>
      <a href="${articleUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#101820;color:#f0eee4;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">Read The Story</a>
      <p style="margin-top:40px;font-size:11px;color:#999;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
}

/**
 * Sends a Journal article to every subscriber. Best-effort per recipient —
 * one bad address doesn't stop the rest of the send. Returns how many
 * actually went out, which the caller records so an article never gets
 * sent twice.
 */
export async function sendJournalArticleToSubscribers(article: JournalArticle) {
  const apiKey = await getSetting("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY is not set — add it in /admin/settings first");

  const [emails, brand] = await Promise.all([getSubscriberEmails(), getBrandProfile()]);
  if (emails.length === 0) return 0;

  const html = renderArticleEmailHtml(article, brand);
  let sent = 0;

  for (const email of emails) {
    if (await sendEmail(email, article.title, html)) sent++;
  }

  return sent;
}

function renderDropAnnouncementHtml(
  dropName: string,
  description: string,
  heroImageUrl: string,
  ctaUrl: string,
  brand: Awaited<ReturnType<typeof getBrandProfile>>
) {
  const GOLD = "#e0b84a";
  const BORDER = "#2a2a2a";
  return `
    <div style="max-width:560px;margin:0 auto;background-color:#101010;font-family:Helvetica,Arial,sans-serif;color:#f0eee4;">
      <div style="padding:28px 24px 0;text-align:center;">
        <p style="text-transform:uppercase;letter-spacing:0.2em;font-size:11px;color:${GOLD};margin:0;">${brand.brandName}</p>
      </div>
      <img src="${heroImageUrl}" alt="${dropName}" width="560" style="display:block;width:100%;height:auto;margin-top:20px;" />
      <div style="padding:28px 32px 8px;text-align:center;">
        <p style="text-transform:uppercase;letter-spacing:0.15em;font-size:12px;color:${GOLD};margin:0 0 8px;">New Drop</p>
        <h1 style="font-size:26px;margin:0 0 14px;text-transform:uppercase;">${dropName}</h1>
        <p style="font-size:14px;line-height:1.7;color:#cfcfcf;margin:0 0 22px;">${description}</p>
        <a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;background:${GOLD};color:#101010;text-decoration:none;text-transform:uppercase;letter-spacing:0.08em;font-size:13px;font-weight:bold;">Shop The Drop</a>
      </div>
      <div style="margin:28px 32px 0;border-top:1px solid ${BORDER};padding:20px 0 28px;text-align:center;">
        <p style="font-size:13px;line-height:1.6;color:#cfcfcf;margin:0;">
          Already got a pair? Your Good Vibes balance carries over — redeem it at checkout for a
          discount on this drop.
        </p>
      </div>
      <p style="text-align:center;padding:0 24px 28px;font-size:11px;color:#777;">${brand.brandName} · ${brand.siteUrl}</p>
    </div>
  `;
}

/**
 * Announces a new drop/collab to every newsletter subscriber — same list a
 * Journal article goes to. Best-effort per recipient, like
 * sendJournalArticleToSubscribers. Distinct from sendDropLiveEmail in
 * lib/email.ts, which is a single-recipient "your preorder deposit is now
 * live" email for people who already paid a deposit — this is the broader
 * "hey, something new just launched" announcement to the whole list.
 */
export async function sendDropAnnouncementEmail(
  dropName: string,
  description: string,
  heroImageUrl: string,
  ctaPath = "/"
) {
  const apiKey = await getSetting("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY is not set — add it in /admin/settings first");

  const [emails, brand] = await Promise.all([getSubscriberEmails(), getBrandProfile()]);
  if (emails.length === 0) return 0;

  const ctaUrl = `${brand.siteUrl.replace(/\/$/, "")}${ctaPath}`;
  const html = renderDropAnnouncementHtml(dropName, description, heroImageUrl, ctaUrl, brand);
  let sent = 0;

  for (const email of emails) {
    if (await sendEmail(email, `${dropName} just dropped at ${brand.brandName}`, html)) sent++;
  }

  return sent;
}
