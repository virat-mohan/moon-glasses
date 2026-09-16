"use client";

import { useState } from "react";

export function RestockNotifyForm({ chapterSlug }: { chapterSlug: string }) {
  const [wantsNotify, setWantsNotify] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/restock-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, chapterSlug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save your request");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your request");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4 font-sans text-body-s text-ink">
        You&apos;re on the list — we&apos;ll email you the moment it&apos;s back.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={wantsNotify}
          onChange={(e) => setWantsNotify(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        <span className="font-sans text-body-s text-ink">Notify me when this is back in stock</span>
      </label>

      {wantsNotify && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-start gap-2">
          <input
            type="text"
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-40 border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-52 border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={submitting}
            className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Notify Me"}
          </button>
          {error && <p className="w-full text-caption text-paint-orange">{error}</p>}
        </form>
      )}
    </div>
  );
}
