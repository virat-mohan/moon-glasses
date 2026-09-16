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
