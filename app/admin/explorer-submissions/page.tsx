"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { chapters } from "@/lib/chapters";

type Submission = {
  id: string;
  photo_url: string;
  testimonial: string;
  location: string | null;
  email: string | null;
  chapter_slugs: string[];
  status: string;
  instagram_posted: boolean;
  created_at: string;
};

export default function ExplorerSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/explorer-submissions")
      .then((res) => res.json())
      .then((data) => setSubmissions(data.submissions ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setStatus(id: string, status: string) {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await fetch("/api/admin/explorer-submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function toggleChapter(sub: Submission, slug: string) {
    const next = sub.chapter_slugs.includes(slug)
      ? sub.chapter_slugs.filter((s) => s !== slug)
      : [...sub.chapter_slugs, slug];
    setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, chapter_slugs: next } : s)));
    await fetch("/api/admin/explorer-submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sub.id, status: sub.status, chapterSlugs: next }),
    });
  }

  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function chapterNames(slugs: string[]) {
    if (slugs.length === 0) return null;
    return slugs.map((slug) => chapters.find((c) => c.slug === slug)?.name ?? slug).join(", ");
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Explorer Submissions</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Approving publishes the photo to the Explorers wall and best-effort posts it as an
        Instagram Story (once Meta + an Instagram Business account are configured in
        /admin/settings).
      </p>

      <div className="mt-10">
        <h2 className="font-display text-heading-s uppercase text-ink">Pending ({pending.length})</h2>
        {loading ? (
          <p className="mt-4 text-body-s text-secondary-text">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="mt-4 text-body-s text-secondary-text">Nothing waiting for review.</p>
        ) : (
          <div className="mt-4 space-y-8">
            {pending.map((sub) => (
              <div key={sub.id} className="grid gap-4 border-t border-divider pt-6 md:grid-cols-[160px_1fr]">
                <div className="relative aspect-square overflow-hidden bg-surface-alt">
                  <Image src={sub.photo_url} alt="" fill sizes="160px" className="object-cover" />
                </div>
                <div>
                  <p className="text-body-s text-ink">{sub.testimonial}</p>
                  <p className="mt-1 text-caption text-secondary-text">
                    {sub.location ?? "Location not given"} · {sub.email ?? "no email"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chapters.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => toggleChapter(sub, c.slug)}
                        className={`border px-2 py-1 text-micro uppercase tracking-[0.03em] ${
                          sub.chapter_slugs.includes(c.slug)
                            ? "border-ink bg-ink text-cream"
                            : "border-divider text-secondary-text"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setStatus(sub.id, "approved")}
                      className="border border-ink bg-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream"
                    >
                      Approve &amp; Publish
                    </button>
                    <button
                      onClick={() => setStatus(sub.id, "rejected")}
                      className="border border-divider px-4 py-1.5 font-sans text-caption uppercase tracking-[0.05em] text-secondary-text"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-heading-s uppercase text-ink">Reviewed ({reviewed.length})</h2>
          <div className="mt-4 space-y-6">
            {reviewed.map((sub) => (
              <div key={sub.id} className="grid gap-4 border-t border-divider pt-6 md:grid-cols-[100px_1fr]">
                <div className="relative aspect-square overflow-hidden bg-surface-alt">
                  <Image src={sub.photo_url} alt="" fill sizes="100px" className="object-cover" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-micro uppercase tracking-[0.03em] ${
                        sub.status === "approved" ? "text-tan-gold" : "text-secondary-text"
                      }`}
                    >
                      {sub.status === "approved" ? "🟢 Approved" : "⚪ Rejected"}
                    </span>
                    <span className="text-micro text-secondary-text">{formatDate(sub.created_at)}</span>
                    {sub.status === "approved" && sub.instagram_posted && (
                      <span className="text-micro text-secondary-text">· posted to Instagram</span>
                    )}
                  </div>
                  <p className="mt-1 text-body-s text-ink">{sub.testimonial}</p>
                  <p className="mt-1 text-caption text-secondary-text">
                    {chapterNames(sub.chapter_slugs) ?? "No product tagged"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
