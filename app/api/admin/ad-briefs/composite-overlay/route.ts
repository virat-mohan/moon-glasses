import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateAndUploadTextOverlayImage } from "@/lib/creative-overlay";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.baseImageUrl) {
    return NextResponse.json({ error: "Missing id or baseImageUrl" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("overlay_text")
      .eq("id", body.id)
      .maybeSingle();
    if (!brief?.overlay_text) {
      return NextResponse.json({ error: "This brief has no overlay text set" }, { status: 400 });
    }

    const imageUrl = await generateAndUploadTextOverlayImage(body.id, body.baseImageUrl, brief.overlay_text);

    const { error } = await supabase
      .from("ad_briefs")
      .update({ image_url: imageUrl, image_source: "real_with_text" })
      .eq("id", body.id);
    if (error) throw error;

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Failed to composite text overlay", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not composite overlay" },
      { status: 500 }
    );
  }
}
