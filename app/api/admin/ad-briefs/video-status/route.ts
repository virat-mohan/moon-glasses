import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { checkVideoStatus } from "@/lib/video-gen";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data: brief } = await supabase
      .from("ad_briefs")
      .select("video_operation_name")
      .eq("id", body.id)
      .maybeSingle();

    if (!brief?.video_operation_name) {
      return NextResponse.json({ error: "No video generation in progress" }, { status: 400 });
    }

    const result = await checkVideoStatus(brief.video_operation_name, body.id);

    if (result.done) {
      await supabase
        .from("ad_briefs")
        .update({ video_status: "ready", video_url: result.videoUrl })
        .eq("id", body.id);
      return NextResponse.json({ status: "ready", videoUrl: result.videoUrl });
    }

    return NextResponse.json({ status: "generating" });
  } catch (err) {
    console.error("Failed to check video status", err);
    const supabase = getSupabaseServerClient();
    await supabase.from("ad_briefs").update({ video_status: "failed" }).eq("id", body.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video generation failed" },
      { status: 500 }
    );
  }
}
