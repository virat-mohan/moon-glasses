import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateJournalDraft } from "@/lib/claude";
import { chapters, chapterImageSrc } from "@/lib/chapters";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("journal_drafts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ drafts: data ?? [] });
  } catch (err) {
    console.error("Failed to list journal drafts", err);
    return NextResponse.json({ drafts: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  try {
    const draft = await generateJournalDraft(body.topic);
    // Auto-suggest a hero image immediately rather than requiring a manual
    // pick — the first referenced Chapter's real photo when there is one,
    // else the brand mark. Still overridable via the "Choose Hero Photo"
    // picker in /admin/journal-drafts.
    const heroChapter = chapters.find((c) => c.slug === draft.relatedChapterSlugs[0]);
    const heroImage = heroChapter
      ? chapterImageSrc(heroChapter.folder, heroChapter.primary)
      : "/images/brand/moonglasses-logo-color-v2.png";

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("journal_drafts")
      .insert({
        topic: body.topic,
        title: draft.title,
        subtitle: draft.subtitle,
        category: draft.category,
        excerpt: draft.excerpt,
        body: draft.body,
        related_chapter_slugs: draft.relatedChapterSlugs,
        reading_time: draft.readingTime,
        hero_image: heroImage,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (err) {
    console.error("Failed to generate journal draft", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || (!body?.status && body?.heroImage == null)) {
    return NextResponse.json({ error: "Missing id and status/heroImage" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (body.status != null) patch.status = body.status;
  if (body.heroImage != null) patch.hero_image = body.heroImage;

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("journal_drafts").update(patch).eq("id", body.id);
    if (error) throw error;

    // A hero-image change on a draft that's already been published needs to
    // reach the live journal_articles row too — that row is a one-time copy
    // made at publish time, not a live view of the draft, so without this a
    // hero-photo change after publishing silently never showed up live.
    if (body.heroImage != null) {
      const { data: draft } = await supabase
        .from("journal_drafts")
        .select("published_slug")
        .eq("id", body.id)
        .maybeSingle();
      if (draft?.published_slug) {
        await supabase
          .from("journal_articles")
          .update({ hero_image: body.heroImage })
          .eq("slug", draft.published_slug);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update journal draft", err);
    return NextResponse.json({ error: "Could not update draft" }, { status: 500 });
  }
}
