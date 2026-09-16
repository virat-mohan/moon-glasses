"use client";

import { useState } from "react";

export function NewsletterBlock() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="border-t border-divider py-20 text-center">
      <p className="font-display text-heading-l uppercase text-ink md:text-heading-xl">
        Keep Exploring.
      </p>
      <p className="mx-auto mt-3 max-w-md font-sans text-body-s text-secondary-text">
        Receive new Chapters, travel stories and exclusive drops before everyone else.
      </p>

      {status === "done" ? (
        <p className="mx-auto mt-8 max-w-md font-sans text-body-s uppercase tracking-[0.05em] text-tan-gold">
          You&apos;re In.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-md items-center gap-3 px-6">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="YOUR EMAIL"
            className="w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s uppercase tracking-[0.05em] text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="whitespace-nowrap border border-ink bg-ink px-6 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
          >
            {status === "loading" ? "..." : "Join"}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="mt-3 text-caption text-paint-orange">Something went wrong — mind trying again?</p>
      )}
    </section>
  );
}
