"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { chapterImageSrc } from "@/lib/chapters";
import { PRODUCT_BG, PRODUCT_SHOT_CLASS } from "@/components/collection/CatalogueCard";

/** Mobile product photos: full-width, zoomed in, swipe between angles and the model shot. */
export function MobileProductGallery({
  folder,
  images,
  modelImage,
  name,
}: {
  folder: string;
  images: string[];
  modelImage?: string;
  name: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hasModel, setHasModel] = useState(true);
  const model = modelImage ?? `/images/chapters/${encodeURIComponent(folder)}/lifestyle.jpg`;
  const slides = [
    ...images.map((img) => ({ src: chapterImageSrc(folder, img), isModel: false })),
    ...(hasModel ? [{ src: model, isModel: true }] : []),
  ];

  function onScroll() {
    const el = trackRef.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="-mx-6">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div
            key={s.src}
            className="relative aspect-[4/5] w-full flex-none snap-center overflow-hidden"
            style={{ backgroundColor: s.isModel ? "var(--moon-black)" : PRODUCT_BG }}
          >
            <Image
              src={s.src}
              alt={i === 0 ? name : ""}
              fill
              sizes="100vw"
              priority={i === 0}
              onError={s.isModel ? () => setHasModel(false) : undefined}
              className={s.isModel ? "object-cover object-[50%_18%]" : PRODUCT_SHOT_CLASS}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {slides.map((s, i) => (
          <span
            key={s.src}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-divider"}`}
          />
        ))}
      </div>
    </div>
  );
}
