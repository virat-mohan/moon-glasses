import type { Chapter } from "@/types/chapter";

/**
 * Limited Series — a separate, small-batch drop line from the core 16-SKU
 * catalogue in lib/chapters.ts. Higher price tier, deliberately low stock,
 * sold-out-and-gone rather than restocked. Kept in its own file/array so it
 * never mixes into the core collection's grouping, pricing copy, or
 * inventory assumptions.
 *
 * PENDING: no products added yet — waiting on real product-cutout and
 * model photography for this line (see /admin/product-images once SKUs
 * exist). The page at /limited-series renders an empty-state until then.
 */
export const LIMITED_SERIES_PRICING = {
  Plastic: 1749,
  Metal: 2149,
} as const;

export const limitedSeries: Chapter[] = [];
