import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapters as staticChapters, chapterImageSrc } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemsParam = searchParams.get("items") || "";
  const allChapters = await getAllChapters().catch(() => staticChapters);

  const resolvedLines: { chapter: Chapter; image: string; quantity: number }[] = [];
  for (const part of itemsParam.split(",")) {
    const [slugRaw, qtyRaw] = part.split(":");
    if (!slugRaw) continue;
    const cleanSlug = decodeURIComponent(slugRaw).trim().toLowerCase();
    const normClean = cleanSlug.replace(/_/g, "-");
    const bareClean = normClean.replace(/^moon-/, "");
    const chapter = allChapters.find((c) => {
      const cSlug = c.slug.toLowerCase().trim().replace(/_/g, "-");
      const cBare = cSlug.replace(/^moon-/, "");
      return (
        cSlug === normClean ||
        cBare === bareClean ||
        `moon-${cBare}` === normClean ||
        (c.name && c.name.toLowerCase().includes(bareClean.replace(/-/g, " ")))
      );
    });
    if (!chapter) continue;
    const quantity = Math.max(1, parseInt(qtyRaw ?? "1", 10) || 1);
    const rawImage = chapter.sideImage || chapter.primary;
    const image = rawImage ? chapterImageSrc(chapter.folder, rawImage) : "/images/hero.jpg";
    resolvedLines.push({ chapter, image, quantity });
  }

  return NextResponse.json({ lines: resolvedLines });
}
