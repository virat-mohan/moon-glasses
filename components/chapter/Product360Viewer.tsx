"use client";

import Image from "next/image";
import { useState } from "react";
import { chapterImageSrc } from "@/lib/chapters";
import { PRODUCT_BG, PRODUCT_SHOT_CLASS } from "@/components/collection/CatalogueCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Product360Viewer({
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
  const [frame, setFrame] = useState(0);
  const [hasModel, setHasModel] = useState(true);
  const model = modelImage ?? `/images/chapters/${encodeURIComponent(folder)}/lifestyle.jpg`;
  const frames = [
    ...images.map((img) => ({ src: chapterImageSrc(folder, img), isModel: false })),
    ...(hasModel ? [{ src: model, isModel: true }] : []),
  ];
  const count = frames.length;
  const current = Math.min(frame, count - 1);

  const step = (d: number) => setFrame((f) => (Math.min(f, count - 1) + d + count) % count);
  const arrow =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-ink bg-cream text-ink opacity-0 transition hover:bg-ink hover:text-cream group-hover:opacity-100";

  return (
    <div>
      <div
        className="group relative aspect-[4/5] overflow-hidden shadow-[inset_0_0_0_1px_var(--moon-gold)]"
        style={{ backgroundColor: frames[current]?.isModel ? "var(--moon-black)" : PRODUCT_BG }}
      >
        {frames.map((f, i) => (
          <Image
            key={f.src}
            src={f.src}
            alt={i === current ? name : ""}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className={`${f.isModel ? "object-cover object-[50%_18%]" : PRODUCT_SHOT_CLASS} transition-opacity duration-300`}
            style={{ opacity: i === current ? 1 : 0 }}
            priority={i === 0}
            onError={f.isModel ? () => setHasModel(false) : undefined}
          />
        ))}

        <button onClick={() => step(-1)} aria-label="Previous photo" className={`${arrow} left-4`}>
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <button onClick={() => step(1)} aria-label="Next photo" className={`${arrow} right-4`}>
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {frames.map((f, i) => (
          <button
            key={f.src}
            onClick={() => setFrame(i)}
            style={{ backgroundColor: f.isModel ? "var(--moon-black)" : PRODUCT_BG }}
            className={`relative aspect-square overflow-hidden shadow-[inset_0_0_0_1px_var(--moon-gold)] transition-opacity ${i === current ? "opacity-100 ring-1 ring-ink" : "opacity-60 hover:opacity-100"}`}
            aria-label={`${name} photo ${i + 1}`}
          >
            <Image
              src={f.src}
              alt=""
              fill
              sizes="120px"
              className={f.isModel ? "object-cover object-[50%_18%]" : PRODUCT_SHOT_CLASS}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
