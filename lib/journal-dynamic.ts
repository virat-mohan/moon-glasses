import {
  journalArticles as staticArticles,
  journalIssues,
  type JournalArticle,
} from "@/lib/journal";
import { chapters } from "@/lib/chapters";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Static articles plus anything published from /admin/journal-drafts (see
 * its Publish action) — same merge pattern as chapters-dynamic.ts. Server
 * only (uses the Supabase service role client).
 */
export async function getAllJournalArticles(): Promise<JournalArticle[]> {
  let published: JournalArticle[] = [];
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from("journal_articles").select("*");
    published = (data ?? []).map((row) => ({
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      category: row.category,
      readingTime: row.reading_time,
      publishedAt: row.published_at,
      heroImage: row.hero_image,
      excerpt: row.excerpt,
      body: row.body,
      relatedChapterSlugs: row.related_chapter_slugs ?? [],
      issue: row.issue,
    }));
  } catch (err) {
    console.error("getAllJournalArticles: Supabase fetch failed, falling back to static list", err);
  }

  // A published draft's slug could collide with a static article's — the
  // static one wins, since it's the one actually reviewed into the
  // codebase; the draft would need a different title/slug to go live.
  const staticSlugs = new Set(staticArticles.map((a) => a.slug));
  return [...staticArticles, ...published.filter((a) => !staticSlugs.has(a.slug))];
}

export async function getJournalArticle(slug: string) {
  const all = await getAllJournalArticles();
  return all.find((a) => a.slug === slug);
}

export async function allJournalArticlesSorted() {
  const all = await getAllJournalArticles();
  return [...all].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function relatedChaptersFor(article: JournalArticle) {
  return chapters.filter((c) => article.relatedChapterSlugs.includes(c.slug));
}

export function issuesSorted() {
  return [...journalIssues].sort((a, b) => b.number - a.number);
}

export async function articlesForIssue(issueNumber: number) {
  const all = await getAllJournalArticles();
  return all
    .filter((a) => a.issue === issueNumber)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
}

export function getIssue(issueNumber: number) {
  return journalIssues.find((i) => i.number === issueNumber);
}

/** Every Chapter mentioned across an Issue's articles, in first-mention order. */
export async function featuredChaptersForIssue(issueNumber: number) {
  const slugs: string[] = [];
  for (const article of await articlesForIssue(issueNumber)) {
    for (const slug of article.relatedChapterSlugs) {
      if (!slugs.includes(slug)) slugs.push(slug);
    }
  }
  return chapters.filter((c) => slugs.includes(c.slug));
}
