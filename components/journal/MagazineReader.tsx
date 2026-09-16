"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { chapters, chapterImageSrc } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";
import type { JournalArticle, JournalIssue } from "@/lib/journal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ChapterChip({ chapter }: { chapter: Chapter }) {
  return (
    <Link href={`/chapter/${chapter.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden bg-surface-alt">
        <Image
          src={chapterImageSrc(chapter.folder, chapter.primary)}
          alt={chapter.name}
          fill
          sizes="140px"
          className="object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <p className="mt-2 text-caption uppercase tracking-[0.03em] text-ink">{chapter.name}</p>
      <p className="text-caption text-secondary-text">₹{chapter.price.toLocaleString("en-IN")}</p>
    </Link>
  );
}

export function MagazineReader({
  issue,
  articles,
  featuredChapters,
  startSlug,
  onClose,
}: {
  issue: JournalIssue;
  articles: JournalArticle[];
  featuredChapters: Chapter[];
  startSlug?: string;
  /** When given, "Close Issue" calls this instead of navigating to /journal — used to preview a not-yet-published draft inline in /admin/journal-drafts without leaving the page. */
  onClose?: () => void;
}) {
  const startIndex = startSlug ? articles.findIndex((a) => a.slug === startSlug) : -1;
  const [page, setPage] = useState(startIndex >= 0 ? startIndex + 1 : 0);
  const [direction, setDirection] = useState(1);
  const totalPages = articles.length + 1;
  const scrollRef = useRef<HTMLDivElement>(null);

  function goTo(next: number) {
    if (next < 0 || next >= totalPages) return;
    setDirection(next > page ? 1 : -1);
    setPage(next);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [page]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(page + 1);
      if (e.key === "ArrowLeft") goTo(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let cooldown = false;

    function onWheel(e: WheelEvent) {
      if (cooldown || e.deltaY <= 0) return;
      const atBottom = el!.scrollTop + el!.clientHeight >= el!.scrollHeight - 4;
      if (atBottom && page < totalPages - 1) {
        cooldown = true;
        goTo(page + 1);
        setTimeout(() => {
          cooldown = false;
        }, 700);
      }
    }

    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages]);

  const issueTitle = issue.name.replace(/^Issue No\. \d+ — /, "");
  const article = page > 0 ? articles[page - 1] : null;
  const articleChapters = article
    ? chapters.filter((c) => article.relatedChapterSlugs.includes(c.slug))
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-cream">
      <header className="flex h-14 items-center justify-between border-b border-divider px-6 md:px-12">
        {onClose ? (
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-caption uppercase tracking-[0.1em] text-secondary-text hover:text-ink"
          >
            <X size={14} /> Close Preview
          </button>
        ) : (
          <Link
            href="/journal"
            className="flex items-center gap-2 text-caption uppercase tracking-[0.1em] text-secondary-text hover:text-ink"
          >
            <X size={14} /> Close Issue
          </Link>
        )}
        <p className="text-micro uppercase tracking-[0.1em] text-secondary-text">
          {issue.name} · Page {page + 1} of {totalPages}
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail rail */}
        <nav className="hidden w-40 shrink-0 overflow-y-auto border-r border-divider px-3 py-6 md:block">
          <button onClick={() => goTo(0)} className="block w-full text-left">
            <div
              className={`relative aspect-[3/4] overflow-hidden bg-charcoal ${
                page === 0 ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
              }`}
            >
              {articles[0] && (
                <Image
                  src={articles[0].heroImage}
                  alt="Cover"
                  fill
                  sizes="140px"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black/40" />
              <p className="absolute inset-x-1 bottom-1 text-center text-[0.6rem] uppercase leading-tight tracking-[0.05em] text-white">
                {issueTitle}
              </p>
            </div>
          </button>
          {articles.map((a, i) => (
            <button key={a.slug} onClick={() => goTo(i + 1)} className="mt-3 block w-full text-left">
              <div
                className={`relative aspect-[3/4] overflow-hidden bg-surface-alt ${
                  page === i + 1 ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={a.heroImage} alt={a.title} fill sizes="140px" className="object-cover" />
              </div>
              <p className="mt-1 text-[0.6rem] uppercase leading-tight tracking-[0.03em] text-secondary-text">
                {a.title}
              </p>
            </button>
          ))}
        </nav>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              key={page}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-[820px] px-6 py-12 md:px-0"
            >
              {page === 0 ? (
                <div className="text-center">
                  <p className="text-caption uppercase tracking-[0.2em] text-secondary-text">
                    Issue No. {String(issue.number).padStart(2, "0")}
                  </p>
                  <h1 className="mt-4 font-display text-heading-xl uppercase leading-[0.95] text-ink">
                    {issueTitle}
                  </h1>
                  <p className="mx-auto mt-4 max-w-md text-body-s text-secondary-text">
                    {issue.theme}
                  </p>

                  <div className="mx-auto mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {articles.slice(0, 4).map((a) => (
                      <div key={a.slug} className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                        <Image src={a.heroImage} alt={a.title} fill sizes="220px" className="object-cover" />
                      </div>
                    ))}
                  </div>

                  <div className="mx-auto mt-12 max-w-md border-t border-b border-divider py-6 text-left">
                    <p className="mb-3 text-caption uppercase tracking-[0.1em] text-secondary-text">
                      In This Issue
                    </p>
                    <ol className="space-y-2">
                      {articles.map((a, i) => (
                        <li key={a.slug}>
                          <button
                            onClick={() => goTo(i + 1)}
                            className="group flex w-full gap-3 text-left"
                          >
                            <span className="text-caption text-secondary-text">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-caption uppercase tracking-[0.02em] text-ink group-hover:underline">
                              {a.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {featuredChapters.length > 0 && (
                    <div className="mx-auto mt-12 max-w-2xl">
                      <p className="mb-5 text-caption uppercase tracking-[0.1em] text-secondary-text">
                        Caps Featured In This Issue
                      </p>
                      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                        {featuredChapters.map((c) => (
                          <ChapterChip key={c.slug} chapter={c} />
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => goTo(1)}
                    className="mt-12 border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
                  >
                    Start Reading
                  </button>
                </div>
              ) : article ? (
                <div>
                  <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
                    {article.category} · {formatDate(article.publishedAt)} · {article.readingTime} min
                    read
                  </p>
                  <h1 className="mt-3 font-display text-heading-m uppercase leading-[0.95] text-ink md:text-heading-l">
                    {article.title}
                  </h1>
                  <p className="mt-3 text-body text-secondary-text">{article.subtitle}</p>

                  <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden bg-surface-alt">
                    <Image
                      src={article.heroImage}
                      alt={article.title}
                      fill
                      sizes="820px"
                      className="object-cover"
                      priority
                    />
                  </div>

                  <article className="mx-auto mt-10 max-w-[680px]">
                    {article.body.map((paragraph, i) =>
                      paragraph.startsWith("> ") ? (
                        <blockquote
                          key={i}
                          className="my-8 border-l-2 border-ink pl-6 font-display text-heading-s uppercase leading-tight text-ink"
                        >
                          {paragraph.slice(2)}
                        </blockquote>
                      ) : (
                        <p key={i} className="mb-5 text-body-s leading-relaxed text-ink">
                          {paragraph}
                        </p>
                      )
                    )}
                  </article>

                  {articleChapters.length > 0 && (
                    <div className="mx-auto mt-12 max-w-[680px] border-t border-divider pt-8">
                      <p className="mb-5 text-caption uppercase tracking-[0.1em] text-secondary-text">
                        Featured In This Story
                      </p>
                      <div className="grid grid-cols-2 gap-5">
                        {articleChapters.map((c) => (
                          <ChapterChip key={c.slug} chapter={c} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <footer className="flex h-14 items-center justify-between border-t border-divider px-6 md:px-12">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          className="flex items-center gap-1 text-caption uppercase tracking-[0.1em] text-ink disabled:text-secondary-text/40"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 w-1.5 rounded-full ${i === page ? "bg-ink" : "bg-divider"}`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages - 1}
          className="flex items-center gap-1 text-caption uppercase tracking-[0.1em] text-ink disabled:text-secondary-text/40"
        >
          Next <ChevronRight size={16} />
        </button>
      </footer>
    </div>
  );
}
