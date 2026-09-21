"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

/**
 * Collage-style tile: product shot and lifestyle shot live on opposite faces
 * of a 3D-flipped card (real rotateY, not a cross-fade). The interaction
 * model (explained once, in TileGrid, not per-tile):
 *  - Desktop: moving the mouse onto the tile flips it to its other face; the
 *    tile reverts to its original ("first") face the moment the mouse
 *    leaves — a hover preview, not a sticky toggle. A click navigates to
 *    the product page — hover already owns flipping, so click is free for
 *    navigation.
 *  - Touch: the first tap flips the tile and it stays flipped (no hover to
 *    revert it on); a second tap navigates to the product page.
 *  - Keyboard: Enter/Space flips, matching the no-hover touch behavior.
 * Buy Now sits on a static overlay that never flips, always reachable.
 * The tile itself carries no name/price/hint text — full details live on
 * the product page. Silently stays product-only if no lifestyle shot
 * exists yet at public/images/chapters/<folder>/lifestyle.jpg.
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
  const router = useRouter();
  const [hasLifestyle, setHasLifestyle] = useState(true);
  // The tile's resting face — TileGrid may pre-pick some tiles to rest on
  // their model face (pickDiverseModelFlips) so a grid doesn't load all-product.
  // Hover previews the OTHER face and always reverts to this one on mouse-out.
  const firstState = useRef(initialFlipped ?? index % 2 === 1).current;
  const [flipped, setFlipped] = useState(firstState);
  const lastPointerTypeRef = useRef<string>("mouse");
  const tappedOnceRef = useRef(false);

  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const lifestyleImage =
    chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const disabled = stockLabel === "out-of-stock";

  const shown = hasLifestyle && flipped;

  function toggleFlip() {
    if (!hasLifestyle) return;
    setFlipped((f) => !f);
  }

  function goToProduct() {
    router.push(`/chapter/${chapter.slug}`);
  }

  return (
    <div
      className="group relative aspect-square overflow-hidden border border-[rgba(231,199,122,0.35)]"
      style={{ backgroundColor: shown ? "var(--moon-black)" : "#fff" }}
    >
      <div
        role="button"
        aria-label={`${chapter.name} — ${flipped ? "showing model photo" : "showing product photo"}`}
        tabIndex={0}
        onPointerEnter={(e) => {
          lastPointerTypeRef.current = e.pointerType;
          if (e.pointerType === "mouse" && hasLifestyle) setFlipped(!firstState);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setFlipped(firstState);
        }}
        onPointerDown={(e) => {
          lastPointerTypeRef.current = e.pointerType;
        }}
        onClick={(e) => {
          e.preventDefault();
          if (lastPointerTypeRef.current === "mouse") {
            // Hover already flips on mouse — a click is purely "go to the
            // product page" since flipping is already spoken for.
            goToProduct();
            return;
          }
          // Touch: first tap flips (the tile's only way to flip, since
          // there's no hover), a second tap goes to the product page.
          if (!hasLifestyle || tappedOnceRef.current) {
            goToProduct();
          } else {
            tappedOnceRef.current = true;
            toggleFlip();
          }
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
          {/* Front face — product, on white. Many lenses are semi-transparent
              tints, not opaque color — their apparent colour is a blend with
              whatever sits behind them, so this has to stay white to match
              the real product photos (which are shot/composited on white).
              A black or coloured background here would visibly shift every
              translucent lens tint away from its true colour. Thin gold
              accent border instead gives it a premium "pop" against the
              black page without touching the interior white. */}
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

      {!disabled && (
        <div className="absolute bottom-3 right-3">
          <BuyNowButton chapter={chapter} image={productImage} disabled={disabled} quantity={1} variant="minimal" />
        </div>
      )}
    </div>
  );
}
