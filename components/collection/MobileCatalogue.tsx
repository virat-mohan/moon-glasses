"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CatalogueCard, PRODUCT_BG, PRODUCT_SHOT_CLASS, type CatalogueItem } from "@/components/collection/CatalogueCard";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";

/** Mobile-only catalogue: one big photo per product, tap to switch model/product, swipe for the next pair. */
export function MobileCatalogue({ items }: { items: CatalogueItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    const slide = el?.firstElementChild as HTMLElement | null;
    if (!el || !slide) return;
    setIndex(Math.round(el.scrollLeft / (slide.offsetWidth + 24)));
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-6 flex snap-x snap-mandatory overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: "1.5rem", gap: "1.5rem" }}
      >
        {items.map((item) => (
          <div key={item.chapter.slug} className="w-full flex-none snap-center">
            <CatalogueCard {...item} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
        {Math.min(index + 1, items.length)} / {items.length} · Swipe for more · Tap to flip
      </p>
    </div>
  );
}

/**
 * Mobile browse-everything view: two product shots per row so every design is
 * visible in one scroll. Product first (easiest way to compare frames at this
 * size); the "Worn" pill flips a tile to its model photo, tapping the photo
 * opens the product page.
 */
export function MobileCatalogueGrid({ items }: { items: CatalogueItem[] }) {
  return (
    <div>
      <p className="mb-3 font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
        {items.length} pairs · Tap &ldquo;Worn&rdquo; to see it on
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6">
        {items.map((item) => (
          <MobileGridTile key={item.chapter.slug} {...item} />
        ))}
      </div>
    </div>
  );
}

function MobileGridTile({ chapter, stockLabel }: CatalogueItem) {
  const [worn, setWorn] = useState(false);
  const [hasModel, setHasModel] = useState(true);
  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const modelImage = chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const showModel = worn && hasModel;
  const soldOut = stockLabel === "out-of-stock";

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden" style={{ backgroundColor: showModel ? "var(--moon-black)" : PRODUCT_BG }}>
        <Link href={`/chapter/${chapter.slug}`} aria-label={chapter.name} className="absolute inset-0">
          <Image
            src={productImage}
            alt={chapter.name}
            fill
            sizes="50vw"
            className={`${PRODUCT_SHOT_CLASS} transition-opacity duration-300`}
            style={{ opacity: showModel ? 0 : 1 }}
          />
          {hasModel && (
            <Image
              src={modelImage}
              alt=""
              aria-hidden
              fill
              sizes="50vw"
              loading="lazy"
              onError={() => setHasModel(false)}
              className="object-cover object-[50%_22%] transition-opacity duration-300"
              style={{ opacity: showModel ? 1 : 0 }}
            />
          )}
        </Link>
        {hasModel && (
          <button
            type="button"
            onClick={() => setWorn((w) => !w)}
            aria-pressed={worn}
            className={`absolute bottom-2 right-2 border px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
              showModel ? "border-white/60 bg-black/60 text-white" : "border-black/15 bg-white text-black"
            }`}
          >
            {showModel ? "Product" : "Worn"}
          </button>
        )}
        {stockLabel && (
          <span className="absolute left-2 top-2 bg-black px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-white">
            {soldOut ? "Sold Out" : "Selling Fast"}
          </span>
        )}
      </div>
      <Link href={`/chapter/${chapter.slug}`} className="block px-0.5 pt-2">
        <p className="font-sans text-micro uppercase leading-snug tracking-[0.05em] text-secondary-text">
          {shortProductName(chapter.name)}
        </p>
        <p className="font-sans text-caption text-ink">₹{chapter.price.toLocaleString("en-IN")}</p>
      </Link>
    </div>
  );
}
