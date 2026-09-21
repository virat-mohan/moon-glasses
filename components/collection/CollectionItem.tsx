"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

/**
 * Collage-style tile: product shot and lifestyle shot live on opposite faces
 * of a 3D-flipped card (real rotateY, not a cross-fade). No auto-flip timer —
 * the visitor drives it entirely, and every interaction PERMANENTLY flips
 * (nothing reverts on its own):
 *  - Desktop: moving the mouse onto the tile flips it once; moving off does
 *    NOT revert it — it stays on whatever face is now showing.
 *  - Touch/keyboard: a tap or Enter/Space flips it (this is the only
 *    interaction touch gets, since there's no hover).
 * `initialFlipped` (falls back to an index-based alternation) sets which
 * face a tile opens on — the caller decides this so a full grid opens with
 * a deliberate product/model mix rather than every tile defaulting to the
 * product face.
 * The tile itself deliberately carries no name/price — just a small flip
 * hint (also a link through to the product page, since Buy Now skips
 * straight to checkout and nothing else on the tile reaches the PDP) and
 * Buy Now, both on a static overlay that never flips. Full name/price/story
 * live on the product page. Silently stays product-only if no lifestyle
 * shot exists yet at public/images/chapters/<folder>/lifestyle.jpg.
 */
export function CollectionItem({
  chapter,
  stockLabel = null,
  index = 0,
  initialFlipped,
}: {
  chapter: Chapter;
  stockLabel?: StockLabel;
  index?: number;
  initialFlipped?: boolean;
}) {
  const [hasLifestyle, setHasLifestyle] = useState(true);
  const [flipped, setFlipped] = useState(initialFlipped ?? index % 2 === 1);
  const lastPointerTypeRef = useRef<string>("mouse");

  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const lifestyleImage =
    chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const disabled = stockLabel === "out-of-stock";

  const shown = hasLifestyle && flipped;

  function toggleFlip() {
    if (!hasLifestyle) return;
    setFlipped((f) => !f);
  }

  return (
    <div className="group relative aspect-square overflow-hidden bg-[var(--moon-black)]">
      <div
        role="button"
        aria-label={`Show ${flipped ? "product" : "model"} photo for ${chapter.name}`}
        tabIndex={0}
        onPointerEnter={(e) => {
          lastPointerTypeRef.current = e.pointerType;
          if (e.pointerType === "mouse" && hasLifestyle) toggleFlip();
        }}
        onPointerDown={(e) => {
          lastPointerTypeRef.current = e.pointerType;
        }}
        onClick={(e) => {
          e.preventDefault();
          // Mouse already flips on hover-enter — a click right after would
          // just flip it straight back. Touch (no hover) and keyboard
          // activation both need the click/Enter to do the flipping.
          if (lastPointerTypeRef.current === "mouse") return;
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
          className="relative h-full w-full transition-transform duration-1000 ease-[cubic-bezier(.22,.61,.36,1)] [transform-style:preserve-3d]"
          style={{ transform: shown ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* Front face — product, on solid black */}
          <div className="absolute inset-0 bg-[var(--moon-black)] [backface-visibility:hidden]">
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
                className="model-face-img object-cover object-[50%_18%]"
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
        <Link
          href={`/chapter/${chapter.slug}`}
          className="min-w-0 font-sans text-micro uppercase tracking-[0.05em] text-white/70 hover:text-white"
        >
          {hasLifestyle ? (
            <>
              <span className="hidden [@media(hover:hover)]:inline">Hover To Flip</span>
              <span className="hidden [@media(hover:none)]:inline">Tap To Flip</span>
            </>
          ) : (
            "View Details"
          )}
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
