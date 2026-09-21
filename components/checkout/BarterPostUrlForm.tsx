"use client";

import { useState } from "react";

export function BarterPostUrlForm({ orderId, initialUrl }: { orderId: string; initialUrl: string | null }) {
  const [postUrl, setPostUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch(`/api/barter/${orderId}/post-url`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl: postUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your post link");
      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your post link");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex max-w-[420px] flex-col gap-2 sm:flex-row">
      <input
        type="url"
        value={postUrl}
        onChange={(e) => setPostUrl(e.target.value)}
        placeholder="https://instagram.com/p/..."
        className="min-w-0 flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
      />
      <button
        type="submit"
        disabled={!postUrl.trim() || status === "saving"}
        className="shrink-0 border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save Link"}
      </button>
      {error && <p className="text-caption text-paint-orange sm:hidden">{error}</p>}
    </form>
  );
}
