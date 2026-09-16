"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

const FLIP_INTERVAL_MS = 3500;

/**
 * Collage-style tile: product shot and lifestyle shot stacked, auto-flipping
 * back and forth on their own timer — each tile starts on a randomized
 * offset so a grid never flips in unison. Tapping/clicking a tile stops its
 * own auto-flip permanently (the visitor is interacting with it, not just
 * browsing past). Alternated starting side by index so a grid reads as
 * product/model/product/model rather than uniform rows. Name/price and Buy
 * Now share one flex row at the bottom (not two independently-positioned
 * absolute elements) so they can never overlap regardless of name length.
 * Silently stays product-only if no lifestyle shot exists yet at
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
  const [flipped, setFlipped] = useState(index % 2 === 1);
  const pausedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tappedOnceRef = useRef(false);

  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const lifestyleImage = `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const disabled = stockLabel === "out-of-stock";

  useEffect(() => {
    if (!hasLifestyle) return;

    function schedule(delay: number) {
      timeoutRef.current = setTimeout(() => {
        if (pausedRef.current) return;
        setFlipped((f) => !f);
        schedule(FLIP_INTERVAL_MS);
      }, delay);
    }

    // Randomized initial offset (plus a per-index stagger) so tiles in the
    // same grid never flip in lockstep.
    schedule(300 + ((index * 137) % 1200) + Math.random() * 1500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [hasLifestyle, index]);

  const lastPointerTypeRef = useRef<string>("mouse");

  function stopAutoFlip() {
    pausedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }

  // On touch, the first tap just stops the auto-flip and shows whichever
  // image was current (a "preview"); a second tap actually navigates. Mouse
  // clicks navigate immediately — there's no hover-preview step to consume.
  function handleImageClick(e: React.MouseEvent) {
    stopAutoFlip();
    if (lastPointerTypeRef.current === "touch" && !tappedOnceRef.current) {
      tappedOnceRef.current = true;
      e.preventDefault();
    }
  }

  const modelShowing = hasLifestyle && flipped;

  return (
    <div
      className="group relative aspect-square overflow-hidden bg-surface-alt"
      onPointerDown={(e) => {
        lastPointerTypeRef.current = e.pointerType;
        stopAutoFlip();
      }}
    >
      <Link href={`/chapter/${chapter.slug}`} className="absolute inset-0 block" onClick={handleImageClick}>
        <Image
          src={productImage}
          alt={chapter.name}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={`object-contain p-[8%] transition-opacity duration-700 ease-[cubic-bezier(.22,.61,.36,1)] ${
            modelShowing ? "opacity-0" : "opacity-100"
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
            className={`absolute inset-0 object-cover transition-opacity duration-700 ease-[cubic-bezier(.22,.61,.36,1)] ${
              modelShowing ? "opacity-100" : "opacity-0"
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
