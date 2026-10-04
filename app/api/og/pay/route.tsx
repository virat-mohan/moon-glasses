import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapters as staticChapters, chapterImageSrc } from "@/lib/chapters";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const INK = "#1A1A1A";

async function imageDataUri(src: string): Promise<string | null> {
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "image/png";
      if (type.includes("webp")) return null;
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    }
    const type = /\.jpe?g$/i.test(src) ? "image/jpeg" : "image/png";
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", decodeURI(src)));
      return `data:${type};base64,${bytes.toString("base64")}`;
    } catch {
      const res = await fetch(`https://www.moon-glasses.store${encodeURI(decodeURI(src))}`);
      return res.ok ? `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}` : null;
    }
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") || searchParams.get("order") || "";

  let heroSlug = "";
  let heroName = "";

  if (orderId) {
    try {
      const supabase = getSupabaseServerClient();
      const { data: items } = await supabase
        .from("order_items")
        .select("chapter_slug, chapter_name")
        .eq("order_id", orderId)
        .limit(4);

      if (items && items.length > 0) {
        heroSlug = items[0].chapter_slug;
        heroName = items[0].chapter_name;
      }
    } catch (e) {
      console.error("OG pay image order lookup failed", e);
    }
  }

  const allChapters = await getAllChapters().catch(() => staticChapters);

  let imagePath: string | null = null;
  if (heroSlug) {
    const clean = heroSlug.toLowerCase().trim();
    const chapter = allChapters.find(
      (c) =>
        c.slug.toLowerCase().replace(/_/g, "-") === clean.replace(/_/g, "-") ||
        c.slug.toLowerCase().replace(/^moon-/, "").replace(/_/g, "-") === clean.replace(/^moon-/, "").replace(/_/g, "-") ||
        (c.name && c.name.toLowerCase().includes(clean.replace(/[-_]/g, " ")))
    );

    if (chapter) {
      heroName = chapter.name;
      if (/^https?:\/\//.test(chapter.sideImage || "")) {
        imagePath = chapter.sideImage;
      } else if (/^https?:\/\//.test(chapter.primary || "")) {
        imagePath = chapter.primary;
      } else if (chapter.folder) {
        imagePath = chapterImageSrc(chapter.folder, chapter.sideImage || chapter.primary);
      }
    }
  }

  // Fallback if no order found or item not resolved
  if (!imagePath) {
    const fallbackChapter = allChapters[0] || staticChapters[0];
    heroName = heroName || fallbackChapter.name;
    imagePath = fallbackChapter.folder
      ? chapterImageSrc(fallbackChapter.folder, fallbackChapter.sideImage || fallbackChapter.primary)
      : fallbackChapter.primary;
  }

  const glassesPhoto = imagePath ? await imageDataUri(imagePath) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF7F2",
          padding: 24,
        }}
      >
        {glassesPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={glassesPhoto}
            width={552}
            height={552}
            style={{
              objectFit: "contain",
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: 44,
              color: INK,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {heroName}
          </div>
        )}
      </div>
    ),
    {
      width: 600,
      height: 600,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
