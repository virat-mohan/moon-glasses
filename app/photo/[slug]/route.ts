import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapterImageSrc } from "@/lib/chapters";

export const runtime = "nodejs";

/**
 * Short, modular product photo URL: /photo/[slug]
 * Redirects directly to the product's high-res studio angle shot (local or remote Supabase storage).
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  try {
    const chapters = await getAllChapters();
    const chapter = chapters.find((c) => c.slug === slug);
    if (!chapter) {
      return new Response("Product not found", { status: 404 });
    }

    const imageSrc = chapterImageSrc(chapter.folder, chapter.sideImage || chapter.primary);
    const targetUrl = /^https?:\/\//.test(imageSrc)
      ? imageSrc
      : `https://www.moon-glasses.store${imageSrc.startsWith("/") ? "" : "/"}${imageSrc}`;

    return NextResponse.redirect(targetUrl, 307);
  } catch (err) {
    console.error("Photo redirect failed", slug, err);
    return new Response("Error resolving photo", { status: 500 });
  }
}
