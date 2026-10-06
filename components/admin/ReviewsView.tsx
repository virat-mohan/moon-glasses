"use client";

import { useEffect, useMemo, useState } from "react";
import { distribution, summarize } from "@/lib/review-core";

export type Review = {
  id: string;
  order_id: string | null;
  chapter_slug: string | null;
  kind: string;
  customer_name: string;
  rating: number;
  review_text: string | null;
  status: "pending" | "approved" | "hidden";
  verified: boolean;
  admin_reply: string | null;
  flagged_reason: string | null;
  contact: string | null;
  created_at: string;
};
export type Funnel = { requestsSent: number; remindersSent: number; ordersReviewed: number };
type Filter = "pending" | "approved" | "hidden" | "all";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

const btn = "inline-flex min-h-11 items-center border px-4 py-2 text-caption uppercase tracking-[0.05em]";

export function AnalyticsTile({ reviews, funnel }: { reviews: Review[]; funnel: Funnel | null }) {
  const approved = reviews.filter((r) => r.status === "approved");
  const s = summarize(approved);
  const dist = distribution(approved);
  const max = Math.max(1, ...Object.values(dist));
  return (
    <div className="mt-6 grid gap-6 border border-divider p-4 md:grid-cols-[auto_1fr_auto]">
      <div>
        <p className="font-display text-heading-xl text-ink">{s ? s.average.toFixed(1) : "–"}</p>
        <p className="text-caption text-secondary-text">{s ? `${s.count} approved` : "no approved reviews yet"} · {reviews.length} total</p>
      </div>
      <div className="space-y-1" aria-label="Rating distribution">
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <div key={n} className="flex items-center gap-2 text-caption text-secondary-text">
            <span className="w-4">{n}★</span>
            <div className="h-2 flex-1 bg-surface-alt"><div className="h-2 bg-tan-gold" style={{ width: `${(dist[n] / max) * 100}%` }} /></div>
            <span className="w-6 text-right">{dist[n]}</span>
          </div>
        ))}
      </div>
      {funnel && (
        <div className="text-caption text-secondary-text">
          <p className="uppercase tracking-[0.05em]">Review requests</p>
          <p className="mt-1 text-body-s text-ink">{funnel.requestsSent} sent · {funnel.remindersSent} reminded</p>
          <p className="text-body-s text-ink">{funnel.ordersReviewed} orders reviewed{funnel.requestsSent > 0 ? ` (${Math.round((funnel.ordersReviewed / funnel.requestsSent) * 100)}%)` : ""}</p>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ r, onStatus, onReply }: { r: Review; onStatus: (id: string, s: Review["status"]) => void; onReply: (id: string, t: string) => void }) {
  const [reply, setReply] = useState(r.admin_reply ?? "");
  const label = r.status === "approved" ? "Approved" : r.status === "hidden" ? "Hidden" : "Waiting";
  return (
    <div className="border border-divider p-4">
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <span className="text-tan-gold text-body-s">{"★".repeat(r.rating)}<span className="text-divider">{"★".repeat(5 - r.rating)}</span></span>
        <span className={`border px-2 py-0.5 uppercase tracking-[0.05em] ${r.verified ? "border-ink text-ink" : "border-divider text-secondary-text"}`}>{r.verified ? "Verified purchase" : "Unverified"}</span>
        <span className="border border-divider px-2 py-0.5 uppercase tracking-[0.05em] text-secondary-text">{label}</span>
        {r.flagged_reason && <span className="border border-paint-orange px-2 py-0.5 uppercase tracking-[0.05em] text-paint-orange">Flagged: {r.flagged_reason}</span>}
      </div>
      <p className="mt-2 text-caption text-secondary-text">
        {r.kind === "store" ? "Store feedback" : `Pair: ${r.chapter_slug}`} · {r.customer_name} · {formatDate(r.created_at)}
        {r.order_id && ` · order #${r.order_id.slice(0, 8).toUpperCase()}`}
        {r.contact && ` · ${r.contact}`}
      </p>
      {r.review_text && <p className="mt-2 text-body-s text-ink">{r.review_text}</p>}
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Public reply, shown under the review"
        aria-label="Public reply"
        rows={2}
        className="mt-3 w-full border border-ink/30 bg-surface px-3 py-2 text-base text-ink outline-none focus:border-ink"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onReply(r.id, reply)} className={`${btn} border-divider text-ink`}>{r.admin_reply ? "Update reply" : "Save reply"}</button>
        {r.status !== "approved" && <button onClick={() => onStatus(r.id, "approved")} className={`${btn} border-ink text-ink hover:bg-ink hover:text-cream`}>Approve</button>}
        {r.status !== "hidden" && <button onClick={() => onStatus(r.id, "hidden")} className={`${btn} border-divider text-secondary-text`}>Hide</button>}
      </div>
    </div>
  );
}

export function ReviewsView({ reviews, funnel, loading, onStatus, onReply }: {
  reviews: Review[]; funnel: Funnel | null; loading: boolean;
  onStatus: (id: string, s: Review["status"]) => void; onReply: (id: string, t: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const filtered = useMemo(() => (filter === "all" ? reviews : reviews.filter((r) => r.status === filter)), [reviews, filter]);
  const names: Record<Filter, string> = { pending: "Waiting", approved: "Approved", hidden: "Hidden", all: "All" };
  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Reviews</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Order-linked reviews publish on their own unless flagged. Unverified feedback waits here. Negative reviews are hidden at most, never deleted.
      </p>
      <AnalyticsTile reviews={reviews} funnel={funnel} />
      <div className="mt-6 flex flex-wrap gap-2 border-t border-divider pt-6">
        {(["pending", "approved", "hidden", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`${btn} ${filter === f ? "border-ink bg-ink text-cream" : "border-divider text-ink"}`}>
            {names[f]}{f !== "all" ? ` (${reviews.filter((r) => r.status === f).length})` : ""}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-body-s text-secondary-text">Nothing here.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((r) => <ReviewCard key={r.id} r={r} onStatus={onStatus} onReply={onReply} />)}
        </div>
      )}
    </main>
  );
}

