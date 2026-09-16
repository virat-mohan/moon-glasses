"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Chapter } from "@/types/chapter";
import { chapterImageSrc } from "@/lib/chapters";
import { ease } from "@/lib/motion";
import type { StockLabel } from "@/lib/inventory";

export function ChapterCard({
  chapter,
  index = 0,
  stockLabel = null,
}: {
  chapter: Chapter;
  index?: number;
  stockLabel?: StockLabel;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: ease.premium, delay: (index % 4) * 0.08 }}
    >
      <Link href={`/chapter/${chapter.slug}`} className="group block">
        <div className="chapter-card-bg relative aspect-square overflow-hidden rounded-lg bg-surface-alt">
          {/* Deliberately sideImage, not chapter.primary — the hero image an
              admin picks for the chapter page shouldn't change what shows up
              here; every product's card should use the same side-angle shot. */}
          <Image
            src={chapterImageSrc(chapter.folder, chapter.sideImage)}
            alt={chapter.name}
            fill
            sizes="(min-width: 1024px) 20vw, 33vw"
            className="object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-105"
          />
          {stockLabel && (
            <span
              className={`absolute left-2 top-2 px-2 py-1 text-micro font-bold uppercase tracking-[0.05em] ${
                stockLabel === "out-of-stock" ? "bg-ink text-cream" : "bg-tan-gold text-ink"
              }`}
            >
              {stockLabel === "out-of-stock" ? "Sold Out" : "Selling Fast"}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="font-sans text-body-s uppercase tracking-[0.03em] text-ink">
              {chapter.name}
            </p>
            <p className="font-sans text-caption text-secondary-text">{chapter.series}</p>
          </div>
          <p className="mt-1 font-sans text-body-s text-ink sm:mt-0">
            ₹{chapter.price.toLocaleString("en-IN")}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
