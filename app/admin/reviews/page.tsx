"use client";

import { useEffect, useState } from "react";
import { ReviewsView, type Funnel, type Review } from "@/components/admin/ReviewsView";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/admin/reviews")
      .then((res) => res.json())
      .then((data) => { setReviews(data.reviews ?? []); setFunnel(data.funnel ?? null); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) load();
  }
  function onStatus(id: string, status: Review["status"]) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    void patch({ id, status });
  }
  function onReply(id: string, reply: string) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, admin_reply: reply.trim() || null } : r)));
    void patch({ id, reply });
  }
  return <ReviewsView reviews={reviews} funnel={funnel} loading={loading} onStatus={onStatus} onReply={onReply} />;
}
