import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

// Folder -> tags. Everything found gets inserted with url = the existing
// /public path — no need to re-host what Next.js already serves.
const SOURCES: { dir: string; tags: string[] }[] = [
  { dir: "public/images/brand", tags: ["logo"] },
  { dir: "public/images/lifestyle", tags: ["lifestyle", "people-wearing"] },
  { dir: "public/images/community", tags: ["people-wearing", "customer"] },
  { dir: "public/images/craftsmanship", tags: ["product", "detail"] },
  { dir: "public/images/patches", tags: ["product", "detail"] },
  { dir: "public/images/team", tags: ["people"] },
];

export async function POST() {
  try {
    const supabase = getSupabaseServerClient();
    const { data: existing } = await supabase.from("marketing_assets").select("url");
    const existingUrls = new Set((existing ?? []).map((r) => r.url));

    const toInsert: { url: string; label: string; tags: string[] }[] = [];

    for (const source of SOURCES) {
      const absDir = path.join(process.cwd(), source.dir);
      if (!fs.existsSync(absDir)) continue;
      for (const file of fs.readdirSync(absDir)) {
        if (!IMAGE_EXT.test(file)) continue;
        const url = `/${source.dir.replace("public/", "")}/${encodeURIComponent(file)}`;
        if (existingUrls.has(url)) continue;
        toInsert.push({ url, label: file.replace(IMAGE_EXT, ""), tags: source.tags });
      }
    }

    // Product tag from the 16 static chapters' hero images.
    const { chapters, chapterImageSrc } = await import("@/lib/chapters");
    for (const chapter of chapters) {
      const url = chapterImageSrc(chapter.folder, chapter.primary);
      if (existingUrls.has(url)) continue;
      toInsert.push({ url, label: chapter.name, tags: ["product", chapter.slug] });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    const { error } = await supabase.from("marketing_assets").insert(toInsert);
    if (error) throw error;

    return NextResponse.json({ inserted: toInsert.length });
  } catch (err) {
    console.error("Failed to seed marketing assets", err);
    return NextResponse.json({ error: "Could not seed marketing assets" }, { status: 500 });
  }
}
