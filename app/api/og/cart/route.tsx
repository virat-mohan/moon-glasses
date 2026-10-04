import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapters as staticChapters, chapterImageSrc } from "@/lib/chapters";

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
  const rawItems = searchParams.get("items") || searchParams.get("item") || "moon-round-demi-brown-blue-graded:1";

  // Parse items suffix: e.g. "moon-round-demi-brown-blue-graded:1,moon-aviator-grey-light-blue:1"
  const itemEntries = rawItems
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [slug, qtyStr] = s.split(":");
      return { slug: slug?.toLowerCase() ?? "", quantity: Number(qtyStr) || 1 };
    })
    .filter((i) => i.slug);

  const allChapters = await getAllChapters().catch(() => staticChapters);

  const resolvedItems = itemEntries.slice(0, 4).map((entry) => {
    const clean = entry.slug;
    const chapter = allChapters.find(
      (c) =>
        c.slug.toLowerCase() === clean ||
        c.slug.toLowerCase().replace(/^moon-/, "") === clean ||
        c.name.toLowerCase().includes(clean.replace(/[-_]/g, " "))
    );
    let imageSrc: string | null = null;
    if (chapter) {
      if (/^https?:\/\//.test(chapter.sideImage || "")) {
        imageSrc = chapter.sideImage;
      } else if (/^https?:\/\//.test(chapter.primary || "")) {
        imageSrc = chapter.primary;
      } else if (chapter.folder) {
        imageSrc = chapterImageSrc(chapter.folder, chapter.sideImage || chapter.primary);
      }
    }
    return {
      name: chapter ? chapter.name : clean.replace(/[-_]/g, " ").toUpperCase(),
      slug: chapter ? chapter.slug : clean,
      imagePath: imageSrc,
      quantity: entry.quantity,
    };
  });

  const heroItem =
    resolvedItems.find((r) => r.imagePath) ||
    resolvedItems[0] || {
      name: "Halo Round",
      slug: "moon-round-demi-brown-blue-graded",
      imagePath: "/images/chapters/moon-round-demi-brown-blue-graded/angle_no_bg.png",
      quantity: 1,
    };

  const glassesPhoto = heroItem.imagePath ? await imageDataUri(heroItem.imagePath) : null;

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
            {heroItem.name}
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
