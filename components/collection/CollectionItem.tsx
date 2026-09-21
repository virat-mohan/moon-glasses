"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

/**
 * Collage-style tile: product shot and lifestyle shot live on opposite faces
 * of a 3D-flipped card (real rotateY, not a cross-fade). No auto-flip timer —
 * the visitor drives it entirely:
 *  - Grid opens on an alternating product/model pattern (even index starts
 *    on the product face, odd starts on the model face), so a full 16-tile
 *    grid reads as 8 products / 8 models rather than a uniform wall.
 *  - Desktop: hovering previews the other face; moving off reverts to
 *    whichever face is "locked in".
 *  - Any device: a tap/click locks in a flip to the other face (this is how
 *    touch users flip, and how mouse users can settle on a face without
 *    having to keep hovering).
 * Name/price and Buy Now sit on a static overlay that never flips, so
 * they're always reachable no matter which face is showing. Silently stays
 * product-only if no lifestyle shot exists yet at
 * public/images/chapters/<folder>/lifestyle.jpg.
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
  const [baseFlipped, setBaseFlipped] = useState(index % 2 === 1);
  const [hoverPreview, setHoverPreview] = useState(false);

  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const lifestyleImage =
    chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const disabled = stockLabel === "out-of-stock";

  const flipped = hasLifestyle && (hoverPreview ? !baseFlipped : baseFlipped);

  function toggleFlip() {
    if (!hasLifestyle) return;
    setBaseFlipped((f) => !f);
    setHoverPreview(false);
  }

  return (
    <div className="group relative aspect-square overflow-hidden bg-white">
      <div
        role="button"
        aria-label={`Show ${flipped ? "product" : "model"} photo for ${chapter.name}`}
        tabIndex={0}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && hasLifestyle) setHoverPreview(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHoverPreview(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          toggleFlip();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleFlip();
          }
        }}
        className="absolute inset-0 cursor-pointer [perspective:1200px]"
      >
        <div
          className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(.22,.61,.36,1)] [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front face — product, on white */}
          <div className="absolute inset-0 bg-white [backface-visibility:hidden]">
            <Image
              src={productImage}
              alt={chapter.name}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-contain p-[8%]"
            />
          </div>

          {/* Back face — model, on black */}
          {hasLifestyle && (
            <div
              className="absolute inset-0 bg-[var(--moon-black)] [backface-visibility:hidden]"
              style={{ transform: "rotateY(180deg)" }}
            >
              <Image
                src={lifestyleImage}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                onError={() => setHasLifestyle(false)}
                className="object-cover object-[50%_18%]"
              />
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

      {stockLabel && (
        <span className="pointer-events-none absolute left-2 top-2 border border-white/40 bg-black px-2 py-1 text-micro uppercase tracking-[0.05em] text-white">
          {stockLabel === "out-of-stock" ? "Sold Out" : "Selling Fast"}
        </span>
      )}

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
