"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CatalogueCard, PRODUCT_BG, PRODUCT_SHOT_CLASS, type CatalogueItem } from "@/components/collection/CatalogueCard";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { PRICE_NOTE_SHORT } from "@/lib/price-copy";

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

  function go(dir: 1 | -1) {
    const el = trackRef.current;
    const slide = el?.firstElementChild as HTMLElement | null;
    if (el && slide) el.scrollBy({ left: dir * (slide.offsetWidth + 24), behavior: "instant" });
  }
  const arrowClass =
    "absolute top-[40%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-[26px] leading-none text-white";

  return (
    <div className="relative">
      {index > 0 && (
        <button type="button" aria-label="Previous pair" onClick={() => go(-1)} className={`${arrowClass} left-1`}>‹</button>
      )}
      {index < items.length - 1 && (
        <button type="button" aria-label="Next pair" onClick={() => go(1)} className={`${arrowClass} right-1`}>›</button>
      )}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-6 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingInline: "1.5rem", gap: "1.5rem" }}
      >
        {items.map((item, i) => (
          <div key={item.chapter.slug} className="w-full flex-none snap-center">
            <CatalogueCard {...item} startModel={i % 2 === 0} swipeFlips={false} arrows={false} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
        {Math.min(index + 1, items.length)} / {items.length} · Swipe for the next pair · Tap to flip
      </p>
    </div>
  );
}

/**
 * Mobile browse-everything view: two product shots per row so every design is
 * visible in one scroll. Same interaction as the swipe cards: tap the photo to
 * flip product/model, tap the name to open the product page.
 */
export function MobileCatalogueGrid({ items }: { items: CatalogueItem[] }) {
  return (
    <div>
      <p className="mb-3 font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
        More pairs · Tap or swipe a photo to switch product / model · Tap the underlined name for its page
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6">
        {items.map((item) => (
          <MobileGridTile key={item.chapter.slug} {...item} startModel={false} />
        ))}
      </div>
    </div>
  );
}

function MobileGridTile({ chapter, stockLabel, startModel = false }: CatalogueItem) {
  const [flipped, setFlipped] = useState(startModel);
  const [hasModel, setHasModel] = useState(true);
  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const modelImage = chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const showModel = flipped && hasModel;
  const startX = useRef<number | null>(null);
  const soldOut = stockLabel === "out-of-stock";

  return (
    <div>
      <button
        type="button"
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (startX.current === null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 25) {
            e.preventDefault(); // swipe: show the other photo, and don't also count as a tap
            setFlipped((f) => !f);
          }
        }}
        onClick={() => setFlipped((f) => !f)}
        aria-label={`${chapter.name}: ${showModel ? "showing it worn" : "showing the product"}`}
        className="relative block aspect-square w-full touch-pan-y overflow-hidden"
        style={{ backgroundColor: showModel ? "var(--moon-black)" : PRODUCT_BG }}
      >
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
        {hasModel && (
          <>
            <span aria-hidden className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[24px] leading-none text-white/95 [text-shadow:0_0_6px_rgba(0,0,0,0.6)]">‹</span>
            <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[24px] leading-none text-white/95 [text-shadow:0_0_6px_rgba(0,0,0,0.6)]">›</span>
          </>
        )}
        {stockLabel && (
          <span className="absolute left-2 top-2 bg-black px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-white">
            {soldOut ? "Sold Out" : "Selling Fast"}
          </span>
        )}
      </button>
      <Link href={`/chapter/${chapter.slug}`} className="block px-0.5 pt-2">
        <p className="font-sans text-micro uppercase leading-snug tracking-[0.05em] text-ink underline underline-offset-4 decoration-ink/50">
          {shortProductName(chapter.name)}
        </p>
        <p className="mt-0.5 font-sans text-caption text-ink">₹{chapter.price.toLocaleString("en-IN")}</p>
        <p className="font-sans text-micro text-secondary-text">{PRICE_NOTE_SHORT}</p>
      </Link>
    </div>
  );
}
