import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdImage } from "@/lib/image-gen";
import { chapters, chapterImageSrc } from "@/lib/chapters";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.imagePrompt) {
    return NextResponse.json({ error: "Missing id or imagePrompt" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("chapter_slug, chapter_slugs, image_urls, creative_format")
      .eq("id", body.id)
      .maybeSingle();

    // A multi-chapter carousel has a different product per card — use that
    // card's own chapter as the reference photo instead of the brief's
    // (nonexistent) single chapter_slug.
    const slugForSlot =
      typeof body.slotIndex === "number" && brief?.chapter_slugs
        ? brief.chapter_slugs[body.slotIndex]
        : brief?.chapter_slug;
    const chapter = chapters.find((c) => c.slug === slugForSlot);
    const referenceImageUrl = chapter ? chapterImageSrc(chapter.folder, chapter.primary) : undefined;
    const absoluteReference =
      referenceImageUrl && referenceImageUrl.startsWith("/")
        ? new URL(referenceImageUrl, request.url).toString()
        : referenceImageUrl;

    const imageUrl = await generateAdImage({
      prompt: body.imagePrompt,
      referenceImageUrl: absoluteReference,
      storagePathPrefix: "generated",
      aspectRatio: brief?.creative_format === "story" ? "portrait" : "square",
    });

    // A carousel card (slotIndex present) writes into image_urls[slotIndex]
    // instead of the singular image_url — read-modify-write since Supabase
    // doesn't support a partial array-index update directly. Re-reading the
    // array HERE (right before the write) rather than reusing the row
    // fetched before the slow generateAdImage call above is what makes this
    // safe when two slots are generated close together: reusing the
    // pre-generation snapshot let a later-finishing request silently
    // overwrite an earlier one's slot with stale (missing) data for every
    // OTHER slot — exactly how a full carousel came back with only the
    // last-written slots filled in.
    if (typeof body.slotIndex === "number") {
      const { data: latest } = await supabase
        .from("ad_briefs")
        .select("image_urls")
        .eq("id", body.id)
        .maybeSingle();
      const current: (string | null)[] = Array.isArray(latest?.image_urls) ? [...latest.image_urls] : [];
      while (current.length < body.slotIndex + 1) current.push(null);
      current[body.slotIndex] = imageUrl;
      const { error } = await supabase
        .from("ad_briefs")
        .update({ image_urls: current, image_source: "generated" })
        .eq("id", body.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("ad_briefs")
        .update({ image_url: imageUrl, image_source: "generated" })
        .eq("id", body.id);
      if (error) throw error;
    }

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Failed to generate ad image", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate image" },
      { status: 500 }
    );
  }
}
