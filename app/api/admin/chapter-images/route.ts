import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const chapters = await getAllChapters();
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // `value` is what gets sent back to /api/admin/hero-override — the raw
  // filename for static chapters (chapterImageSrc still needs to resolve it),
  // or the already-full Storage URL for dynamic chapters.
  const images = chapter.images.map((img) => ({
    display: chapterImageSrc(chapter.folder, img),
    value: img,
  }));

  return NextResponse.json({
    name: chapter.name,
    images,
    currentPrimary: chapter.primary,
    price: chapter.price,
    story: chapter.story,
  });
}
