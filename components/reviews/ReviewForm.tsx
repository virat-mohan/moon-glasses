"use client";

import { useState } from "react";
import { REVIEW_COPY as C } from "@/lib/review-core";
import { Honeypot, StarInput, buttonClass, fieldClass } from "@/components/reviews/StarInput";

type ItemToReview = { chapterSlug: string; chapterName: string };

export function ReviewForm({
  orderId,
  items,
  customerName,
  googleUrl,
  instagramUrl,
}: {
  orderId: string;
  items: ItemToReview[];
  customerName: string;
  googleUrl: string;
  instagramUrl: string;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [trap, setTrap] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const entries = items
      .filter((i) => ratings[i.chapterSlug])
      .map((i) => ({ chapterSlug: i.chapterSlug, rating: ratings[i.chapterSlug], text: texts[i.chapterSlug] ?? "" }));
    if (entries.length === 0) {
      setError("Tap a star to rate your pair first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, entries, name: name || customerName, website: trap }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save your review. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="border-t border-divider pt-8">
        <h2 className="font-display text-heading-l text-ink">{C.thanksTitle}</h2>
        <p className="mt-3 max-w-md text-base text-secondary-text">{C.thanksBody}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>{C.googleOption}</a>
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>{C.instagramOption}</a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative" noValidate>
      {items.map((item) => (
        <div key={item.chapterSlug} className="border-t border-divider py-6">
          <p className="font-sans text-base uppercase tracking-[0.03em] text-ink">{item.chapterName}</p>
          <div className="-ml-1 mt-2">
            <StarInput
              label={`Rating for ${item.chapterName}`}
              value={ratings[item.chapterSlug] ?? 0}
              onChange={(v) => setRatings((p) => ({ ...p, [item.chapterSlug]: v }))}
            />
          </div>
          <textarea
            placeholder={C.textPlaceholder}
            aria-label={`Your thoughts on ${item.chapterName}`}
            value={texts[item.chapterSlug] ?? ""}
            onChange={(e) => setTexts((p) => ({ ...p, [item.chapterSlug]: e.target.value }))}
            maxLength={1000}
            rows={3}
            className={`mt-3 ${fieldClass}`}
          />
        </div>
      ))}
      <div className="border-t border-divider pt-6">
        <input
          type="text"
          autoComplete="given-name"
          placeholder={C.namePlaceholder}
          aria-label="Your name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
        <Honeypot value={trap} onChange={setTrap} />
        <button type="submit" disabled={submitting} className={`mt-4 ${buttonClass}`}>
          {submitting ? "Saving..." : C.submit}
        </button>
        {error && <p role="alert" className="mt-3 text-base text-paint-orange">{error}</p>}
      </div>
    </form>
  );
}
