"use client";

import { useState } from "react";
import { SharePost } from "@/components/checkout/SharePost";
import { BARTER_PAGE_COPY as C } from "@/lib/pwap-email-copy";

export type KitView = { id: string; code: string; sales: number; url: string };

/** Every post kit of the order: image + share buttons, its code (copyable) and the sales on it. */
export function BarterKits({
  orderId,
  initialKits,
  maxPosts,
  canAddMore,
  siteDomain,
  handle,
}: {
  orderId: string;
  initialKits: KitView[];
  maxPosts: number;
  canAddMore: boolean;
  siteDomain: string;
  handle: string;
}) {
  const [kits, setKits] = useState(initialKits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const atCap = kits.length >= maxPosts;

  async function addKit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/barter/${orderId}/kits`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(C.capReached);
        return;
      }
      if (!res.ok || !data.kit) throw new Error("x");
      setKits((k) => [...k, data.kit]);
    } catch {
      setError(C.anotherError);
    } finally {
      setBusy(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {}
  }

  return (
    <div className="space-y-8">
      {kits.map((k, i) => {
        const caption = `Shop ${siteDomain} and use my code ${k.code} at checkout 🌙 ${handle}\n\nPowered by Pay With A Post™`;
        return (
          <section key={k.id} aria-label={`Post ${i + 1}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-caption font-bold uppercase tracking-[0.1em] text-ink">Post {i + 1}</p>
              <p className="text-caption text-secondary-text">{k.sales} {k.sales === 1 ? "sale" : "sales"} on this code</p>
            </div>
            <SharePost orderId={orderId} kitId={k.id} cardUrl={k.url} caption={caption} />
            <div className="mt-3 flex items-center justify-between gap-3 border border-divider p-3">
              <code className="break-all text-body-s font-bold tracking-[0.06em] text-ink">{k.code}</code>
              <button type="button" onClick={() => copy(k.code)} className="min-h-[44px] flex-none border border-[var(--moon-gold)] px-4 text-caption font-bold uppercase tracking-[0.08em] text-ink">
                {copied === k.code ? C.copied : C.copyCode}
              </button>
            </div>
          </section>
        );
      })}
      {canAddMore && !atCap && (
        <button type="button" onClick={addKit} disabled={busy} className="min-h-[48px] w-full border-2 border-[var(--moon-gold)] py-3 font-sans text-body-s font-bold uppercase tracking-[0.08em] text-ink disabled:opacity-60">
          {busy ? C.makingAnother : C.anotherPost}
        </button>
      )}
      {atCap && <p className="text-caption text-secondary-text">{C.capReached}</p>}
      {error && <p role="alert" className="text-caption text-paint-orange">{error}</p>}
    </div>
  );
}
