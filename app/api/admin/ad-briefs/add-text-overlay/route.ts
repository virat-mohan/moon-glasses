import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAndUploadTextOverlayImage } from "@/lib/creative-overlay";

/**
 * Composites arbitrary bold text onto any already-generated/attached image
 * (single or one carousel card) — the general-purpose version of
 * composite-overlay/route.ts, which only fires the brief's own fixed
 * overlay_text during the "real photo + text" creative-style flow. This one
 * takes whatever caption the admin types, on any image, at any point.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.text) {
    return NextResponse.json({ error: "Missing id or text" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("image_url, image_urls, creative_format")
      .eq("id", body.id)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

    const baseImageUrl = typeof body.slotIndex === "number" ? brief.image_urls?.[body.slotIndex] : brief.image_url;
    if (!baseImageUrl) {
      return NextResponse.json({ error: "There is no existing image to caption yet — generate one first" }, { status: 400 });
    }

    const dimensions = brief.creative_format === "story" ? { width: 1080, height: 1920 } : undefined;
    const imageUrl = await generateAndUploadTextOverlayImage(body.id, baseImageUrl, body.text, dimensions);

    // Re-reading image_urls HERE (right before the write), rather than
    // reusing the row fetched before the slow overlay-generation call above,
    // avoids a lost-update race when two slots are captioned/generated close
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
        .update({ image_urls: current, image_source: "with_text_overlay" })
        .eq("id", body.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("ad_briefs")
        .update({ image_url: imageUrl, image_source: "with_text_overlay" })
        .eq("id", body.id);
      if (error) throw error;
    }

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Failed to add text overlay", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add text to image" },
      { status: 500 }
    );
  }
}
