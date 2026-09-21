"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { chapterImageSrc, shortProductName, pickDiverseModelFlips } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";
import type { StockLabel } from "@/lib/inventory";

type Item = { chapter: Chapter; stockLabel: StockLabel };

/**
 * A tile grid with a mobile-only "now viewing" preview bar above it — tile
 * captions run small (they have to, to fit the tile), so on mobile a tap
 * also mirrors the name/price/photo into a normal-sized bar above the grid
 * rather than relying on the tiny on-tile text. Desktop doesn't need this;
 * the bar is hidden there. Also computes which tiles open on their model
 * face via pickDiverseModelFlips, so the grid never opens all-one-gender.
 */
export function TileGrid({
  items,
  columnsClassName = "grid-cols-2 md:grid-cols-4",
}: {
  items: Item[];
  columnsClassName?: string;
}) {
  const [active, setActive] = useState<{ chapter: Chapter; modelShowing: boolean } | null>(null);
  const flips = useMemo(() => pickDiverseModelFlips(items.map((i) => i.chapter)), [items]);

  const activeImage = active
    ? active.modelShowing
      ? active.chapter.modelImage ??
        `/images/chapters/${encodeURIComponent(active.chapter.folder)}/lifestyle.jpg`
      : chapterImageSrc(active.chapter.folder, active.chapter.sideImage)
    : null;

  return (
    <div>
      {active && (
        <div className="mb-4 flex items-center gap-3 border-b border-divider pb-4 md:hidden">
          <div className="relative h-16 w-16 flex-none overflow-hidden bg-white">
            {activeImage && (
              <Image
                src={activeImage}
                alt=""
                fill
                sizes="64px"
                className={active.modelShowing ? "object-cover object-[50%_18%]" : "object-contain p-1"}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-body-s text-ink">{shortProductName(active.chapter.name)}</p>
            <p className="text-caption text-secondary-text">
              ₹{active.chapter.price.toLocaleString("en-IN")} · {active.modelShowing ? "Model" : "Product"} view
            </p>
          </div>
        </div>
      )}

      <div className={`grid ${columnsClassName} gap-0`}>
        {items.map(({ chapter, stockLabel }, i) => (
          <CollectionItem
            key={chapter.slug}
            chapter={chapter}
            index={i}
            stockLabel={stockLabel}
            initialFlipped={flips[i]}
            onSelect={(c, modelShowing) => setActive({ chapter: c, modelShowing })}
          />
        ))}
      </div>
    </div>
  );
}
