"use client";

import { useState } from "react";

type ItemToReview = { chapterSlug: string; chapterName: string };

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={`text-2xl leading-none ${n <= value ? "text-tan-gold" : "text-divider"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ItemReview({
  orderId,
  item,
  customerName,
}: {
  orderId: string;
  item: ItemToReview;
  customerName: string;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          chapterSlug: item.chapterSlug,
          customerName,
          rating,
          reviewText: text,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save your review");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your review");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="border-t border-divider py-6">
        <p className="font-sans text-body-s uppercase tracking-[0.03em] text-ink">{item.chapterName}</p>
        <p className="mt-2 text-body-s text-secondary-text">Thanks — your review is in for moderation.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t border-divider py-6">
      <p className="font-sans text-body-s uppercase tracking-[0.03em] text-ink">{item.chapterName}</p>
      <div className="mt-3">
        <StarInput value={rating} onChange={setRating} />
      </div>
      <textarea
        placeholder="What did you think? (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-3 w-full border border-ink/30 bg-surface px-4 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
      />
      <button
        type="submit"
        disabled={submitting}
        className="mt-3 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Submit Review"}
      </button>
      {error && <p className="mt-2 text-caption text-paint-orange">{error}</p>}
    </form>
  );
}

export function ReviewForm({
  orderId,
  items,
  customerName,
}: {
  orderId: string;
  items: ItemToReview[];
  customerName: string;
}) {
  return (
    <div>
      {items.map((item) => (
        <ItemReview key={item.chapterSlug} orderId={orderId} item={item} customerName={customerName} />
      ))}
    </div>
  );
}
