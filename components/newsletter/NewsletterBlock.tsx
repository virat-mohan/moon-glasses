"use client";

import { useState } from "react";
import { useLaunchSoon } from "@/components/launch/LaunchContext";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";

export function NewsletterBlock() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const launchSoon = useLaunchSoon();

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
    <section id="join" className="scroll-mt-20 border-t border-divider py-20 text-center">
      {launchSoon && (
        <p className="mb-3 font-sans text-micro font-bold uppercase tracking-[0.12em] text-tan-gold">Launching soon</p>
      )}
      <p className="font-display text-heading-l uppercase text-ink md:text-heading-xl">
        Join the crew
      </p>
      <p className="mx-auto mt-3 max-w-md font-sans text-body-s text-secondary-text">
        {launchSoon ? (
          <>
            Be first in line for the drop, and for <PayWithAPostMark />.
          </>
        ) : (
          "We\u2019ll keep in touch!"
        )}
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
            className="whitespace-nowrap font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:text-[var(--moon-gold)] disabled:opacity-60"
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
