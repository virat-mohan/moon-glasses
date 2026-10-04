import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { chapters as staticChapters, chapterImageSrc } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";
import CartClient from "./CartClient";

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.moon-glasses.store";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const items = typeof resolved?.items === "string" ? resolved.items : "";
  const ogImageUrl = items
    ? `${SITE_URL}/api/og/cart?items=${encodeURIComponent(items)}&v=hd`
    : `${SITE_URL}/api/og/cart?v=hd`;

  return {
    metadataBase: new URL(SITE_URL),
    title: "Your Cart — Moonglasses",
    description: "Complete your Moonglasses order securely with Free Express Delivery across India.",
    openGraph: {
      type: "website",
      siteName: "Moonglasses",
      title: "Your Cart is Ready — Moonglasses",
      description: "Complete your Moonglasses order securely with Free Express Delivery across India.",
      url: `${SITE_URL}/cart${items ? `?items=${encodeURIComponent(items)}` : ""}`,
      images: [
        {
          url: ogImageUrl,
          width: 600,
          height: 600,
          alt: "Moonglasses Cart",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: "Your Cart is Ready — Moonglasses",
      description: "Complete your Moonglasses order securely with Free Express Delivery across India.",
      images: [ogImageUrl],
    },
  };
}

export default async function CartPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const itemsParam =
    typeof resolved?.items === "string"
      ? resolved.items
      : Array.isArray(resolved?.items)
      ? resolved.items[0] || ""
      : "";

  const initialDeepLinkItems: { chapter: Chapter; image: string; quantity: number }[] = [];

  if (itemsParam) {
    const allChapters = await getAllChapters().catch(() => staticChapters);

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
      initialDeepLinkItems.push({ chapter, image, quantity });
    }
  }

  return (
    <Suspense fallback={null}>
      <CartClient initialDeepLinkItems={initialDeepLinkItems} />
    </Suspense>
  );
}
