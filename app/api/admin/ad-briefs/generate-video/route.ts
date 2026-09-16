import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { startVideoGeneration } from "@/lib/video-gen";
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
      .select("chapter_slug")
      .eq("id", body.id)
      .maybeSingle();

    const chapter = chapters.find((c) => c.slug === brief?.chapter_slug);
    const referenceImageUrl = chapter ? chapterImageSrc(chapter.folder, chapter.primary) : undefined;
    const absoluteReference =
      referenceImageUrl && referenceImageUrl.startsWith("/")
        ? new URL(referenceImageUrl, request.url).toString()
        : referenceImageUrl;

    const editLine = body.editInstruction ? ` Additional direction for this version: ${body.editInstruction}.` : "";
    const videoPrompt = `Short vertical (9:16) lifestyle video, 8 seconds: ${body.imagePrompt}. Natural handheld camera motion, no on-screen text.${editLine}`;
    const operationName = await startVideoGeneration(videoPrompt, absoluteReference);

    const { error } = await supabase
      .from("ad_briefs")
      .update({ video_status: "generating", video_operation_name: operationName })
      .eq("id", body.id);
    if (error) throw error;

    return NextResponse.json({ status: "generating" });
  } catch (err) {
    console.error("Failed to start video generation", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start video generation" },
      { status: 500 }
    );
  }
}
