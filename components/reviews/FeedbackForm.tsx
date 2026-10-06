"use client";

import { useState } from "react";
import { REVIEW_COPY as C } from "@/lib/review-core";
import { Honeypot, StarInput, buttonClass, fieldClass } from "@/components/reviews/StarInput";

export function FeedbackForm() {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [trap, setTrap] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError("Tap a star to rate us first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text, name, contact, website: trap }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save your feedback. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <p role="status" className="mt-8 border-t border-divider pt-8 text-base text-ink">{C.feedbackThanks}</p>;

  return (
    <form onSubmit={submit} className="relative mt-8 space-y-4 border-t border-divider pt-6" noValidate>
      <div className="-ml-1"><StarInput label="Overall rating" value={rating} onChange={setRating} /></div>
      <textarea placeholder="what's on your mind? (optional)" aria-label="Your feedback" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className={fieldClass} />
      <input type="text" autoComplete="given-name" placeholder={C.namePlaceholder} aria-label="Your name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      <input type="text" inputMode="text" autoComplete="off" placeholder="order number or phone (optional)" aria-label="Order number or phone" maxLength={60} value={contact} onChange={(e) => setContact(e.target.value)} className={fieldClass} />
      <Honeypot value={trap} onChange={setTrap} />
      <button type="submit" disabled={submitting} className={buttonClass}>{submitting ? "Saving..." : C.feedbackSubmit}</button>
      {error && <p role="alert" className="text-base text-paint-orange">{error}</p>}
    </form>
  );
}
