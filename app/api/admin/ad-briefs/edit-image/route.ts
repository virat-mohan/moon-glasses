import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAdImage } from "@/lib/image-gen";

/**
 * Re-runs image generation using the CURRENT generated/attached image as the
 * reference plus a free-text edit instruction — i.e. an image-to-image edit
 * ("make the sky more orange", "remove the second person"), not a from-
 * scratch regeneration off the original ad-brief prompt.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.editInstruction) {
    return NextResponse.json({ error: "Missing id or editInstruction" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("image_url, image_urls, creative_format")
      .eq("id", body.id)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    const currentImageUrl =
      typeof body.slotIndex === "number" ? brief.image_urls?.[body.slotIndex] : brief.image_url;
    if (!currentImageUrl) {
      return NextResponse.json({ error: "There is no existing image to edit yet — generate one first" }, { status: 400 });
    }

    const imageUrl = await generateAdImage({
      prompt: body.editInstruction,
      referenceImageUrl: currentImageUrl,
      storagePathPrefix: "generated",
      aspectRatio: brief.creative_format === "story" ? "portrait" : "square",
    });

    // Re-reading image_urls HERE (right before the write), rather than
    // reusing the row fetched before the slow generateAdImage call above,
    // avoids a lost-update race when two slots are edited/generated close
    // together — see generate-image/route.ts for the full story.
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
    console.error("Failed to edit ad image", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not edit image" },
      { status: 500 }
    );
  }
}
