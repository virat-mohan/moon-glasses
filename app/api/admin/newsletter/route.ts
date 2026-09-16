import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { allJournalArticlesSorted } from "@/lib/journal-dynamic";
import { getSubscriberEmails, sendJournalArticleToSubscribers } from "@/lib/newsletter";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const [{ data: sends }, subscribers] = await Promise.all([
      supabase.from("journal_newsletter_sends").select("*"),
      getSubscriberEmails(),
    ]);

    const sendsBySlug = new Map((sends ?? []).map((s) => [s.article_slug, s]));
    const articles = (await allJournalArticlesSorted()).map((a) => ({
      slug: a.slug,
      title: a.title,
      publishedAt: a.publishedAt,
      send: sendsBySlug.get(a.slug) ?? null,
    }));

    return NextResponse.json({ articles, subscriberCount: subscribers.length });
  } catch (err) {
    console.error("Failed to load newsletter status", err);
    return NextResponse.json({ articles: [], subscriberCount: 0 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data: existing } = await supabase
      .from("journal_newsletter_sends")
      .select("article_slug")
      .eq("article_slug", body.slug)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This article has already been sent" }, { status: 400 });
    }

    const article = (await allJournalArticlesSorted()).find((a) => a.slug === body.slug);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const recipientCount = await sendJournalArticleToSubscribers(article);

    await supabase.from("journal_newsletter_sends").insert({
      article_slug: article.slug,
      recipient_count: recipientCount,
    });

    return NextResponse.json({ ok: true, recipientCount });
  } catch (err) {
    console.error("Failed to send newsletter", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send newsletter" },
      { status: 500 }
    );
  }
}
