import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Angle images resolve through chapterImageSrc so both the static
  // filename convention and admin-uploaded full Storage URLs display
  // correctly; up to 3 are shown/kept as "angles" for the product card.
  const angleImages = chapter.images.slice(0, 3).map((img) => chapterImageSrc(chapter.folder, img));

  return NextResponse.json({
    name: chapter.name,
    angleImages,
    modelImage: chapter.modelImage ?? null,
  });
}
