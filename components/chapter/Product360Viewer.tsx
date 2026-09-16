"use client";

import Image from "next/image";
import { useState } from "react";
import { chapterImageSrc } from "@/lib/chapters";
import { ChevronRight } from "lucide-react";

export function Product360Viewer({
  folder,
  images,
  name,
}: {
  folder: string;
  images: string[];
  name: string;
}) {
  const [frame, setFrame] = useState(0);
  const frameCount = images.length;

  const next = () => setFrame((f) => (f + 1) % frameCount);

  return (
    <div>
      <div className="chapter-card-bg relative aspect-square overflow-hidden bg-surface-alt">
        {images.map((img, i) => (
          <Image
            key={img}
            src={chapterImageSrc(folder, img)}
            alt={i === frame ? name : ""}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            style={{ opacity: i === frame ? 1 : 0 }}
            priority={i === 0}
          />
        ))}

        <button
          onClick={next}
          aria-label="Next angle"
          className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-ink bg-cream text-ink transition-colors hover:bg-ink hover:text-cream"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {images.map((img, i) => (
          <button
            key={img}
            onClick={() => setFrame(i)}
            className={`relative aspect-square overflow-hidden bg-surface-alt transition-opacity ${
              i === frame ? "opacity-100 ring-1 ring-ink" : "opacity-60 hover:opacity-100"
            }`}
            aria-label={`${name} angle ${i + 1}`}
          >
            <Image src={chapterImageSrc(folder, img)} alt="" fill sizes="120px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
