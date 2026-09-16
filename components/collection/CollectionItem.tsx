"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

/**
 * Collage-style tile: product shot and lifestyle shot stacked, whichever
 * is "front" on load flips to the other on hover — alternated by index so
 * a grid reads as product/model/product/model rather than uniform rows.
 * Name/price and Buy Now share one flex row at the bottom of the tile (not
 * two independently-positioned absolute elements) so they can never
 * overlap regardless of name length. Silently stays product-only if no
 * lifestyle shot exists yet at public/images/chapters/<folder>/lifestyle.jpg.
 */
export function CollectionItem({
  chapter,
  stockLabel = null,
  index = 0,
}: {
  chapter: Chapter;
  stockLabel?: StockLabel;
  index?: number;
}) {
  const [hasLifestyle, setHasLifestyle] = useState(true);
  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const lifestyleImage = `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const disabled = stockLabel === "out-of-stock";

  // Alternate which image shows by default; hover always reveals the other.
  const modelFirst = hasLifestyle && index % 2 === 1;

  return (
    <div className="group relative aspect-square overflow-hidden bg-surface-alt">
      <Link href={`/chapter/${chapter.slug}`} className="absolute inset-0 block">
        <Image
          src={productImage}
          alt={chapter.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={`object-contain p-[8%] transition-opacity duration-300 ease-[cubic-bezier(.22,.61,.36,1)] ${
            modelFirst ? "opacity-0 group-hover:opacity-100" : "opacity-100 group-hover:opacity-0"
          }`}
        />
        {hasLifestyle && (
          <Image
            src={lifestyleImage}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            onError={() => setHasLifestyle(false)}
            className={`absolute inset-0 object-cover transition-opacity duration-300 ease-[cubic-bezier(.22,.61,.36,1)] ${
              modelFirst ? "opacity-100 group-hover:opacity-0" : "opacity-0 group-hover:opacity-100"
            }`}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {stockLabel && (
          <span className="absolute left-2 top-2 border border-white/40 bg-black px-2 py-1 text-micro uppercase tracking-[0.05em] text-white">
            {stockLabel === "out-of-stock" ? "Sold Out" : "Selling Fast"}
          </span>
        )}
      </Link>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <Link href={`/chapter/${chapter.slug}`} className="min-w-0">
          <p className="truncate font-sans text-caption text-white">{shortProductName(chapter.name)}</p>
          <p className="mt-0.5 font-sans text-caption text-white/70">
            ₹{chapter.price.toLocaleString("en-IN")}
          </p>
        </Link>

        {!disabled && (
          <div className="flex-none">
            <BuyNowButton chapter={chapter} image={productImage} disabled={disabled} quantity={1} variant="minimal" />
          </div>
        )}
      </div>
    </div>
  );
}
