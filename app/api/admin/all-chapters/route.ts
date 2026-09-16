import { NextResponse } from "next/server";
import { getAllChapters } from "@/lib/chapters-dynamic";

export async function GET() {
  const chapters = await getAllChapters();
  return NextResponse.json({
    chapters: chapters.map((c) => ({ slug: c.slug, name: c.name })),
  });
}
