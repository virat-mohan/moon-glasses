"use client";

import { useRef, useState } from "react";
import { CatalogueCard, type CatalogueItem } from "@/components/collection/CatalogueCard";

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
