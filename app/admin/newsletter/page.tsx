"use client";

import { useEffect, useState } from "react";

type ArticleRow = {
  slug: string;
  title: string;
  publishedAt: string;
  send: { recipient_count: number; sent_at: string } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function NewsletterPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingSlug, setSendingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/newsletter")
      .then((res) => res.json())
      .then((data) => {
        setArticles(data.articles ?? []);
        setSubscriberCount(data.subscriberCount ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function send(slug: string) {
    setSendingSlug(slug);
    setError(null);
    try {
      const res = await fetch("/api/admin/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSendingSlug(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Newsletter</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        {subscriberCount.toLocaleString("en-IN")} subscriber{subscriberCount === 1 ? "" : "s"} — footer
        signups plus logged-in customers who&apos;ve opted in, deduplicated by email. Sending an
        article is one-way and one-time per article.
      </p>
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}

      <div className="mt-10 space-y-3">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading...</p>
        ) : (
          articles.map((a) => (
            <div key={a.slug} className="flex items-center justify-between gap-4 border-t border-divider pt-4">
              <div>
                <p className="text-body-s text-ink">{a.title}</p>
                <p className="text-caption text-secondary-text">
                  Published {formatDate(a.publishedAt)}
                  {a.send && (
                    <>
                      {" "}
                      · sent to {a.send.recipient_count.toLocaleString("en-IN")} on{" "}
                      {formatDate(a.send.sent_at)}
                    </>
                  )}
                </p>
              </div>
              {a.send ? (
                <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">Sent ✓</span>
              ) : (
                <button
                  onClick={() => send(a.slug)}
                  disabled={sendingSlug === a.slug}
                  className="shrink-0 border border-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
                >
                  {sendingSlug === a.slug ? "Sending..." : "Send To Subscribers"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
