"use client";

import Link from "next/link";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center md:px-8" data-tone="terracotta">
      <span className="adm-chip">Something went wrong</span>
      <h1 className="mt-4 text-heading-l text-ink">This page couldn’t load just now</h1>
      <p className="mt-3 text-body-s text-secondary-text">
        Nothing was changed. It’s usually a brief connection hiccup — try again, or head back to orders.
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-ink px-5 py-2.5 text-body-s text-cream">Try again</button>
        <Link href="/admin/orders" className="rounded-full border border-divider px-5 py-2.5 text-body-s text-ink no-underline">Go to orders</Link>
      </div>
    </div>
  );
}
