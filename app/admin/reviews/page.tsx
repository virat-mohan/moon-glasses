"use client";

import { useEffect, useMemo, useState } from "react";

type Review = {
  id: string;
  order_id: string;
  chapter_slug: string;
  customer_name: string;
  rating: number;
  review_text: string | null;
  approved: boolean;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");

  function load() {
    fetch("/api/admin/reviews")
      .then((res) => res.json())
      .then((data) => setReviews(data.reviews ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setApproved(id: string, approved: boolean) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
    await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this review? This can't be undone.")) return;
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
  }

  const filtered = useMemo(() => {
    if (filter === "pending") return reviews.filter((r) => !r.approved);
    if (filter === "approved") return reviews.filter((r) => r.approved);
    return reviews;
  }, [reviews, filter]);

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Reviews</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Moderate before anything shows publicly on a Chapter page.
      </p>

      <div className="mt-6 flex gap-2 border-t border-divider pt-6">
        {(["pending", "approved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              filter === f ? "border-ink bg-ink text-cream" : "border-divider text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-body-s text-secondary-text">Nothing here.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="border border-divider p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-sans text-body-s uppercase tracking-[0.03em] text-ink">
                    {r.chapter_slug}
                  </span>
                  <span className="ml-3 text-tan-gold">{"★".repeat(r.rating)}</span>
                  <span className="text-secondary-text">{"★".repeat(5 - r.rating)}</span>
                </div>
                <span className="text-caption text-secondary-text">
                  {r.customer_name} · {formatDate(r.created_at)}
                </span>
              </div>
              {r.review_text && <p className="mt-2 text-body-s text-ink">{r.review_text}</p>}
              <div className="mt-3 flex gap-3">
                {!r.approved ? (
                  <button
                    onClick={() => setApproved(r.id, true)}
                    className="border border-ink px-4 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
                  >
                    Approve
                  </button>
                ) : (
                  <button
                    onClick={() => setApproved(r.id, false)}
                    className="border border-divider px-4 py-1.5 text-caption uppercase tracking-[0.05em] text-secondary-text"
                  >
                    Unapprove
                  </button>
                )}
                <button
                  onClick={() => remove(r.id)}
                  className="text-caption text-secondary-text hover:text-paint-orange"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
