"use client";

import { useMemo } from "react";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { pickDiverseModelFlips } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";
import type { StockLabel } from "@/lib/inventory";

type Item = { chapter: Chapter; stockLabel: StockLabel };

/**
 * A tile grid that opens with a real male/female model mix instead of
 * whatever gender the catalogue order happened to alternate onto (see
 * pickDiverseModelFlips in lib/chapters.ts). Explains the tile interaction
 * once, right above the grid, instead of repeating a hint on every tile —
 * phrasing differs by input since the interaction itself differs (hover
 * exists on desktop, not on touch).
 */
export function TileGrid({
  items,
  columnsClassName = "grid-cols-2 md:grid-cols-4",
}: {
  items: Item[];
  columnsClassName?: string;
}) {
  const flips = useMemo(() => pickDiverseModelFlips(items.map((i) => i.chapter)), [items]);

  return (
    <div>
      <p className="mb-3 font-sans text-micro uppercase tracking-[0.05em] text-secondary-text">
        <span className="hidden [@media(hover:hover)]:inline">Hover To Flip, Click To View Details</span>
        <span className="hidden [@media(hover:none)]:inline">Tap To Flip, Tap Again To View Details</span>
      </p>
      <div className={`tile-grid grid ${columnsClassName} gap-0`}>
        {items.map(({ chapter, stockLabel }, i) => (
          <CollectionItem key={chapter.slug} chapter={chapter} index={i} stockLabel={stockLabel} initialFlipped={flips[i]} />
        ))}
      </div>
    </div>
  );
}
