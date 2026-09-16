"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not send your message");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="text-body-s text-ink">
        Thanks — we&apos;ve got your message and will get back to you soon.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Name
        </label>
        <input
          required
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Message
        </label>
        <textarea
          required
          rows={5}
          placeholder="Your query or comment"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
        />
      </div>

      {error && <p className="text-body-s text-paint-orange">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
