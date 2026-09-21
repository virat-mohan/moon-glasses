import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Every generate/regenerate/edit call in lib/image-gen.ts already logs its
 * result into marketing_assets tagged ["generated-model", gender, chapterSlug]
 * — this just reads that log back for one chapter, newest first, so the
 * Inventory Master lightbox can offer a left/right browser over every past
 * attempt instead of only ever showing the current pick.
 */
export async function GET(request: Request) {
  const chapterSlug = new URL(request.url).searchParams.get("chapterSlug");
  if (!chapterSlug) return NextResponse.json({ error: "Missing chapterSlug" }, { status: 400 });

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("marketing_assets")
      .select("url, created_at")
      .contains("tags", [chapterSlug])
      .contains("tags", ["generated-model"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ urls: (data ?? []).map((r) => r.url as string) });
  } catch (err) {
    console.error("Failed to load model photo history", err);
    return NextResponse.json({ urls: [] }, { status: 500 });
  }
}
