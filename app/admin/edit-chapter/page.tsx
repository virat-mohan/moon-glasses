"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type ImageOption = { display: string; value: string };
type ChapterOption = { slug: string; name: string };

export default function EditChapterPage() {
  const [chapterOptions, setChapterOptions] = useState<ChapterOption[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [images, setImages] = useState<ImageOption[]>([]);
  const [currentPrimary, setCurrentPrimary] = useState<string | null>(null);
  const [price, setPrice] = useState(0);
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/all-chapters")
      .then((res) => res.json())
      .then((data) => {
        setChapterOptions(data.chapters ?? []);
        if (data.chapters?.[0]) setSlug(data.chapters[0].slug);
      });
  }, []);

  useEffect(() => {
    if (!slug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSaved(false);
    setOrderSaved(false);
    fetch(`/api/admin/chapter-images?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.images ?? []);
        setCurrentPrimary(data.currentPrimary ?? null);
        setPrice(data.price ?? 0);
        setStory(data.story ?? "");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function setHero(value: string) {
    setCurrentPrimary(value);
    await fetch("/api/admin/hero-override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterSlug: slug, primaryImage: value }),
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setOrderSaved(false);
    setImages((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveOrder() {
    setSavingOrder(true);
    setOrderSaved(false);
    try {
      await fetch("/api/admin/hero-override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterSlug: slug, images: images.map((img) => img.value) }),
      });
      setOrderSaved(true);
    } finally {
      setSavingOrder(false);
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/hero-override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterSlug: slug, price, story }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Edit A Chapter</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Change the price, story, or hero image (the first photo people see) for any Chapter —
        the original 16 or ones added from /admin/add-chapter. Takes effect immediately.
      </p>

      <select
        value={slug ?? ""}
        onChange={(e) => setSlug(e.target.value)}
        className="mt-8 border border-divider bg-surface px-4 py-2 font-sans text-body-s text-ink"
      >
        {chapterOptions.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <>
          <form onSubmit={saveDetails} className="mt-8 max-w-lg space-y-6">
            <div>
              <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                Price (INR)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                Story
              </label>
              <textarea
                rows={4}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="border border-ink bg-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-50"
            >
              {saved ? "Saved ✓" : saving ? "Saving..." : "Save Price & Story"}
            </button>
          </form>

          <div className="mt-12">
            <p className="font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Hero Image — the first photo shown on cards, the homepage, and this Chapter&apos;s page
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {images.map((img) => {
                const isCurrent = img.value === currentPrimary;
                return (
                  <button key={img.value} onClick={() => setHero(img.value)} className="block text-left">
                    <div
                      className={`relative aspect-square overflow-hidden bg-surface-alt ${
                        isCurrent ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={img.display}
                        alt=""
                        fill
                        sizes="200px"
                        className="object-cover object-bottom"
                      />
                    </div>
                    <p className="mt-1 text-caption uppercase tracking-[0.03em] text-secondary-text">
                      {isCurrent ? "Current Hero" : "Set As Hero"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-12">
            <div className="flex items-center justify-between gap-4">
              <p className="font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                Gallery Order — the order photos cycle through on this Chapter&apos;s page
              </p>
              <button
                onClick={saveOrder}
                disabled={savingOrder}
                className="shrink-0 border border-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
              >
                {orderSaved ? "Saved ✓" : savingOrder ? "Saving..." : "Save Order"}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {images.map((img, i) => (
                <div key={img.value}>
                  <div className="relative aspect-square overflow-hidden bg-surface-alt">
                    <Image src={img.display} alt="" fill sizes="200px" className="object-cover object-bottom" />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-micro text-secondary-text">#{i + 1}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        aria-label="Move earlier"
                        className="border border-divider px-1.5 text-caption text-ink hover:border-ink disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => moveImage(i, 1)}
                        disabled={i === images.length - 1}
                        aria-label="Move later"
                        className="border border-divider px-1.5 text-caption text-ink hover:border-ink disabled:opacity-30"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
