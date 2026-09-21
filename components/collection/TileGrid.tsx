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
 * pickDiverseModelFlips in lib/chapters.ts).
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
    <div className={`grid ${columnsClassName} gap-0`}>
      {items.map(({ chapter, stockLabel }, i) => (
        <CollectionItem key={chapter.slug} chapter={chapter} index={i} stockLabel={stockLabel} initialFlipped={flips[i]} />
      ))}
    </div>
  );
}
