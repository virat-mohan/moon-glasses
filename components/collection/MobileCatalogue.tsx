"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

type Item = { chapter: Chapter; stockLabel: StockLabel };

function Slide({ chapter, stockLabel }: Item) {
  const [showModel, setShowModel] = useState(true);
  const [hasModel, setHasModel] = useState(true);
  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const modelImage = chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const model = hasModel && showModel;
  const soldOut = stockLabel === "out-of-stock";

  return (
    <div className="w-full flex-none snap-center">
      <button
        type="button"
        onClick={() => hasModel && setShowModel((m) => !m)}
        aria-label={`${chapter.name} — tap to see ${model ? "the product" : "it worn"}`}
        className="relative block aspect-[4/5] w-full overflow-hidden"
        style={{ backgroundColor: model ? "var(--moon-black)" : "#fff" }}
      >
        <Image
          src={productImage}
          alt={chapter.name}
          fill
          sizes="100vw"
          className="scale-[1.2] object-contain transition-opacity duration-300"
          style={{ opacity: model ? 0 : 1 }}
        />
        {hasModel && (
          <Image
            src={modelImage}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            onError={() => setHasModel(false)}
            className="object-cover object-[50%_18%] transition-opacity duration-300"
            style={{ opacity: model ? 1 : 0 }}
          />
        )}
        {stockLabel && (
          <span className="absolute left-3 top-3 border border-white/40 bg-black px-2 py-1 text-micro uppercase tracking-[0.05em] text-white">
            {soldOut ? "Sold Out" : "Selling Fast"}
          </span>
        )}
      </button>

      <div className="flex items-end justify-between gap-3 px-1 pt-3">
        <Link href={`/chapter/${chapter.slug}`} className="min-w-0">
          <p className="truncate font-sans text-caption uppercase tracking-[0.05em] text-secondary-text">
            {shortProductName(chapter.name)}
          </p>
          <p className="font-sans text-body text-ink">₹{chapter.price.toLocaleString("en-IN")}</p>
        </Link>
        {!soldOut && (
          <div className="shrink-0 whitespace-nowrap">
            <BuyNowButton chapter={chapter} image={productImage} destination="cart" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Mobile-only catalogue: one big photo per product, tap to switch model/product, swipe for the next pair. */
export function MobileCatalogue({ items }: { items: Item[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    if (!slide) return;
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
          <Slide key={item.chapter.slug} {...item} />
        ))}
      </div>
      <p className="mt-3 text-center font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
        {Math.min(index + 1, items.length)} / {items.length} · Swipe for more · Tap to flip
      </p>
    </div>
  );
}
