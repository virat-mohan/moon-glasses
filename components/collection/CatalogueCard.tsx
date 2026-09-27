"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc, shortProductName } from "@/lib/chapters";
import { BuyNowButton } from "@/components/chapter/BuyNowButton";
import type { StockLabel } from "@/lib/inventory";

export type CatalogueItem = { chapter: Chapter; stockLabel: StockLabel };

export const PRODUCT_BG = "#fff";
export const PRODUCT_SHOT_CLASS = "object-contain p-[5%] contrast-[1.08] saturate-[1.1]";

/**
 * One photo per pair, model first. Touch: each tap switches model/product.
 * Mouse: hover shows the product, click opens the product page.
 */
export function CatalogueCard({ chapter, stockLabel, sizes = "100vw" }: CatalogueItem & { sizes?: string }) {
  const router = useRouter();
  const [showModel, setShowModel] = useState(true);
  const [hasModel, setHasModel] = useState(true);
  const pointerRef = useRef("touch");
  const productImage = chapterImageSrc(chapter.folder, chapter.sideImage);
  const modelImage = chapter.modelImage ?? `/images/chapters/${encodeURIComponent(chapter.folder)}/lifestyle.jpg`;
  const model = hasModel && showModel;
  const soldOut = stockLabel === "out-of-stock";
  const href = `/chapter/${chapter.slug}`;

  return (
    <div>
      <button
        type="button"
        onPointerEnter={(e) => {
          pointerRef.current = e.pointerType;
          if (e.pointerType === "mouse") setShowModel(false);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setShowModel(true);
        }}
        onPointerDown={(e) => {
          pointerRef.current = e.pointerType;
        }}
        onClick={() => {
          if (pointerRef.current === "mouse" || !hasModel) router.push(href);
          else setShowModel((m) => !m);
        }}
        aria-label={`${chapter.name} — ${model ? "showing it worn" : "showing the product"}`}
        className="relative block aspect-[4/5] w-full cursor-pointer overflow-hidden"
        style={{ backgroundColor: model ? "var(--moon-black)" : PRODUCT_BG }}
      >
        <Image
          src={productImage}
          alt={chapter.name}
          fill
          sizes={sizes}
          className={`${PRODUCT_SHOT_CLASS} transition-opacity duration-300`}
          style={{ opacity: model ? 0 : 1 }}
        />
        {hasModel && (
          <Image
            src={modelImage}
            alt=""
            aria-hidden
            fill
            sizes={sizes}
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
        <Link href={href} className="min-w-0 hover:[&>p:first-child]:text-ink">
          <p className="truncate font-sans text-caption uppercase tracking-[0.05em] text-secondary-text transition-colors">
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

export function CatalogueGrid({ items, columnsClassName = "md:grid-cols-3 lg:grid-cols-4" }: { items: CatalogueItem[]; columnsClassName?: string }) {
  return (
    <div>
      <p className="mb-4 font-sans text-micro uppercase tracking-[0.05em] text-secondary-text">
        <span className="hidden [@media(hover:hover)]:inline">Hover. Flip. Deep Dive.</span>
        <span className="hidden [@media(hover:none)]:inline">Tap To Flip</span>
      </p>
      <div className={`grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 ${columnsClassName}`}>
        {items.map((item) => (
          <CatalogueCard key={item.chapter.slug} {...item} sizes="(min-width: 1024px) 25vw, 50vw" />
        ))}
      </div>
    </div>
  );
}
