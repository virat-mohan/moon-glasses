"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { chapterImageSrc } from "@/lib/chapters";
import { ease } from "@/lib/motion";
import type { Chapter } from "@/types/chapter";

export function SeriesCard({
  name,
  slug,
  blurb,
  representative,
  index = 0,
}: {
  name: string;
  slug: string;
  blurb: string;
  representative: Chapter;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: ease.premium, delay: (index % 2) * 0.12 }}
    >
      <Link href={`/series/${slug}`} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-charcoal md:aspect-[3/4]">
          {/* sideImage, not representative.primary — same side-angle shot on
              every series card regardless of that chapter's chosen hero image. */}
          <Image
            src={chapterImageSrc(representative.folder, representative.sideImage)}
            alt={name}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover grayscale-[0.15] contrast-[1.08] transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>
        <div className="mt-4">
          <p className="font-display text-heading-m uppercase leading-[0.95] text-ink md:text-heading-l">
            {name}
          </p>
          <p className="mt-2 max-w-[80%] text-body-s text-secondary-text">{blurb}</p>
        </div>
      </Link>
    </motion.div>
  );
}
