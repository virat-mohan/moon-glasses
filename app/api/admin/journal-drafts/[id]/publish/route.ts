import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { chapters, chapterImageSrc } from "@/lib/chapters";
import { journalIssues } from "@/lib/journal";

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Publishes a journal draft to the live Journal — inserts into
 * journal_articles (merged onto the static lib/journal.ts array by
 * lib/journal-dynamic.ts), then marks the draft "published" with the slug
 * it went live under. Previously this was a fully manual step (copy the
 * draft's fields into lib/journal.ts by hand).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const supabase = getSupabaseServerClient();
    const { data: draft, error: draftError } = await supabase
      .from("journal_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (!draft.title || !draft.body?.length) {
      return NextResponse.json({ error: "Draft is missing title/body" }, { status: 400 });
    }

    const relatedSlugs: string[] = draft.related_chapter_slugs ?? [];
    const heroChapter = chapters.find((c) => c.slug === relatedSlugs[0]);
    // A manually-picked asset (from Marketing Assets) wins over the
    // auto-derived chapter photo — see the picker in /admin/journal-drafts.
    const heroImage =
      draft.hero_image ||
      (heroChapter ? chapterImageSrc(heroChapter.folder, heroChapter.primary) : "/images/brand/moonglasses-logo-color-v2.png");

    const issue = body.issue ?? Math.max(...journalIssues.map((i) => i.number));

    let slug = slugify(draft.title);
    const { data: clash } = await supabase.from("journal_articles").select("slug").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${id.slice(0, 6)}`;

    const { error: insertError } = await supabase.from("journal_articles").insert({
      slug,
      title: draft.title,
      subtitle: draft.subtitle ?? "",
      category: draft.category ?? "Travel Guides",
      reading_time: draft.reading_time ?? 4,
      hero_image: heroImage,
      excerpt: draft.excerpt ?? "",
      body: draft.body,
      related_chapter_slugs: relatedSlugs,
      issue,
    });
    if (insertError) throw insertError;

    await supabase.from("journal_drafts").update({ status: "published", published_slug: slug }).eq("id", id);

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    console.error("Failed to publish journal draft", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not publish draft" },
      { status: 500 }
    );
  }
}
