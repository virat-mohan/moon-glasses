"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { chapters, chapterImageSrc } from "@/lib/chapters";
import { journalArticles, journalIssues, type JournalArticle } from "@/lib/journal";
import { MagazineCover } from "@/components/journal/MagazineCover";
import { MagazineReader } from "@/components/journal/MagazineReader";

type Draft = {
  id: string;
  topic: string;
  title: string | null;
  subtitle: string | null;
  category: string | null;
  excerpt: string | null;
  body: string[] | null;
  related_chapter_slugs: string[] | null;
  reading_time: number | null;
  hero_image: string | null;
  status: string;
  published_slug: string | null;
  created_at: string;
};

type Asset = { id: string; url: string; label: string | null };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function JournalDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  function loadDrafts() {
    fetch("/api/admin/journal-drafts")
      .then((res) => res.json())
      .then((data) => setDrafts(data.drafts ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadDrafts, []);
  useEffect(() => {
    fetch("/api/admin/marketing-assets")
      .then((res) => res.json())
      .then((data) => setAssets(data.assets ?? []));
  }, []);

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/journal-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate draft");
      setDrafts((prev) => [data.draft, ...prev]);
      setTopic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    await fetch("/api/admin/journal-drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  async function setHeroImage(id: string, url: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, hero_image: url } : d)));
    setPickerForId(null);
    await fetch("/api/admin/journal-drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, heroImage: url }),
    });
  }

  async function publish(id: string) {
    if (!confirm("Publish this to the live Journal? It'll be visible on the site immediately.")) return;
    setPublishing(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/journal-drafts/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not publish");
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "published", published_slug: data.slug } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setPublishing(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Journal Draft Generator</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Type a topic, Claude drafts a full article in Moonglasses&apos;s voice, naturally referencing
        1-2 real Chapters where it fits. The preview below is exactly how it&apos;ll look live —
        pick a hero photo from Marketing Assets, then hit Publish.
      </p>

      <div className="mt-8 border-t border-divider pt-6">
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Topic
        </label>
        <div className="mt-3 flex gap-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. a monsoon weekend trip to Goa"
            className="flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
          <button
            onClick={generate}
            disabled={generating || !topic.trim()}
            className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Draft"}
          </button>
        </div>
        {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}
      </div>

      <div className="mt-12 space-y-16">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading...</p>
        ) : drafts.length === 0 ? (
          <p className="text-body-s text-secondary-text">No drafts yet.</p>
        ) : (
          drafts.map((d) => {
            const related = chapters.filter((c) => (d.related_chapter_slugs ?? []).includes(c.slug));
            const heroImage = d.hero_image || (related[0] ? chapterImageSrc(related[0].folder, related[0].primary) : null);

            return (
              <div key={d.id} className="border-t-2 border-ink pt-8">
                {/* Admin controls — not part of the live preview */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-alt px-4 py-3">
                  <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                    from topic &ldquo;{d.topic}&rdquo; · {formatDate(d.created_at)}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPickerForId(pickerForId === d.id ? null : d.id)}
                      className="text-caption uppercase tracking-[0.05em] text-ink underline underline-offset-4"
                    >
                      {pickerForId === d.id ? "Close" : "Choose Hero Photo"}
                    </button>
                    {d.status === "published" ? (
                      <a
                        href={`/journal/issue/${journalIssues[journalIssues.length - 1].number}?article=${d.published_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-caption uppercase tracking-[0.05em] text-ink underline"
                      >
                        View Live ↗
                      </a>
                    ) : (
                      <>
                        <select
                          value={d.status}
                          onChange={(e) => setStatus(d.id, e.target.value)}
                          className="border border-divider bg-surface px-2 py-1 font-sans text-caption text-ink"
                        >
                          <option value="draft">Draft</option>
                          <option value="ready">Ready To Publish</option>
                          <option value="archived">Archived</option>
                        </select>
                        <button
                          onClick={() => publish(d.id)}
                          disabled={publishing === d.id}
                          className="border border-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
                        >
                          {publishing === d.id ? "Publishing..." : "Publish"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {pickerForId === d.id && (
                  <div className="mt-3 border border-divider p-3">
                    {assets.length === 0 ? (
                      <p className="text-caption text-secondary-text">
                        No assets uploaded yet — see Marketing Assets.
                      </p>
                    ) : (
                      <div className="grid grid-cols-6 gap-2 md:grid-cols-10">
                        {assets.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setHeroImage(d.id, a.url)}
                            className={`relative aspect-square overflow-hidden border-2 ${
                              d.hero_image === a.url ? "border-ink" : "border-transparent"
                            }`}
                            title={a.label ?? undefined}
                          >
                            <Image src={a.url} alt={a.label ?? "Asset"} fill className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Journal index preview — how this reads as an Issue cover thumbnail, mirrors app/journal/page.tsx */}
                {heroImage && (
                  <div className="mt-8">
                    <p className="mb-3 text-caption uppercase tracking-[0.1em] text-secondary-text">
                      As it&apos;ll appear on /journal (Issue index)
                    </p>
                    <div className="max-w-[280px]">
                      <MagazineCover
                        issue={journalIssues[journalIssues.length - 1]}
                        articles={[
                          {
                            slug: d.published_slug ?? "preview",
                            title: d.title ?? "",
                            subtitle: d.subtitle ?? "",
                            category: (d.category ?? "Travel Guides") as JournalArticle["category"],
                            readingTime: d.reading_time ?? 4,
                            publishedAt: d.created_at,
                            heroImage,
                            excerpt: d.excerpt ?? "",
                            body: d.body ?? [],
                            relatedChapterSlugs: d.related_chapter_slugs ?? [],
                            issue: journalIssues[journalIssues.length - 1].number,
                          },
                        ]}
                        coverImage={heroImage}
                      />
                    </div>
                  </div>
                )}

                {/* Quick glance */}
                <div className="mx-auto mt-8 max-w-[760px]">
                  <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
                    {d.category ?? "Uncategorised"} · {formatDate(d.created_at)} · {d.reading_time ?? 4} min read
                  </p>
                  <h2 className="mt-3 font-display text-heading-l uppercase leading-[0.95] text-ink md:text-heading-xl">
                    {d.title}
                  </h2>
                  <p className="mt-4 text-body-l text-secondary-text">{d.subtitle}</p>
                  <button
                    onClick={() => setPreviewingId(d.id)}
                    disabled={!heroImage}
                    className="mt-6 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
                  >
                    Preview As It&apos;ll Look Live (Magazine Reader)
                  </button>
                </div>

                {previewingId === d.id &&
                  heroImage &&
                  (() => {
                    const draftArticle: JournalArticle = {
                      slug: d.published_slug ?? `__preview_${d.id}`,
                      title: d.title ?? "",
                      subtitle: d.subtitle ?? "",
                      category: (d.category ?? "Travel Guides") as JournalArticle["category"],
                      readingTime: d.reading_time ?? 4,
                      publishedAt: d.created_at,
                      heroImage,
                      excerpt: d.excerpt ?? "",
                      body: d.body ?? [],
                      relatedChapterSlugs: d.related_chapter_slugs ?? [],
                      issue: journalIssues[journalIssues.length - 1].number,
                    };
                    const issue = journalIssues[journalIssues.length - 1];
                    const siblings = journalArticles.filter((a) => a.issue === issue.number);
                    const articles = [...siblings, draftArticle];
                    const featuredSlugs = new Set(articles.flatMap((a) => a.relatedChapterSlugs));
                    const featuredChapters = chapters.filter((c) => featuredSlugs.has(c.slug));
                    return (
                      <MagazineReader
                        issue={issue}
                        articles={articles}
                        featuredChapters={featuredChapters}
                        startSlug={draftArticle.slug}
                        onClose={() => setPreviewingId(null)}
                      />
                    );
                  })()}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
