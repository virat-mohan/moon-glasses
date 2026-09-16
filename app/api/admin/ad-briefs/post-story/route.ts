import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { postImageToInstagramStory } from "@/lib/instagram";
import { getBrandProfile } from "@/lib/brand";

/**
 * Posts a single ad-brief image (or one carousel card) to the connected
 * Instagram account's Story feed — separate from postBriefToInstagram
 * (organic feed post) and launchBriefCampaign (paid ad). Doesn't touch
 * posted_at/instagram_post_id, since a Story isn't "the" post for this
 * brief the way a feed publish is — a brief can be Story-posted any number
 * of times (e.g. one card at a time) independent of its feed-post status.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("image_url, image_urls, chapter_slug, chapter_slugs")
      .eq("id", body.id)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    const imageUrl = typeof body.slotIndex === "number" ? brief.image_urls?.[body.slotIndex] : brief.image_url;
    if (!imageUrl) {
      return NextResponse.json({ error: "There is no image to post yet — generate one first" }, { status: 400 });
    }

    // Explicit linkUrl wins; otherwise fall back to this card's own chapter
    // page (a carousel card's chapter comes from chapter_slugs[slotIndex]),
    // so the Story's link sticker still lands somewhere useful by default.
    let linkUrl: string | undefined = typeof body.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : undefined;
    if (!linkUrl) {
      const slug =
        typeof body.slotIndex === "number" ? brief.chapter_slugs?.[body.slotIndex] : brief.chapter_slug;
      if (slug) {
        const brand = await getBrandProfile();
        linkUrl = `${brand.siteUrl.replace(/\/$/, "")}/chapter/${slug}`;
      }
    }

    const { postId } = await postImageToInstagramStory(imageUrl, linkUrl);
    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    console.error("Failed to post ad brief to Instagram Story", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not post to Instagram Story" },
      { status: 500 }
    );
  }
}
