"use client";

import { useEffect, useState } from "react";

type PreorderRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  amount_rupees: number;
  status: "pending" | "paid" | "failed";
  notified_at: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPreordersPage() {
  const [rows, setRows] = useState<PreorderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/preorders")
      .then((res) => res.json())
      .then((data) => setRows(data.preorders ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const paid = rows.filter((r) => r.status === "paid");
  const unnotified = paid.filter((r) => !r.notified_at);
  const totalCollected = paid.reduce((sum, r) => sum + Number(r.amount_rupees), 0);

  async function notifyAll() {
    setNotifying(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/preorders/notify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send notifications");
      setMessage(`Sent ${data.sent} of ${data.total ?? data.sent} emails.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send notifications");
    } finally {
      setNotifying(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Pre-Orders</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        ₹500 deposits reserving a spot before the Friday-night drop. Once the collection is live,
        hit Notify All to email every paid pre-order a heads-up before the public.
      </p>

      <div className="mt-6 flex flex-wrap gap-6 border-y border-divider py-4 text-body-s text-ink">
        <p>{paid.length} paid</p>
        <p>{rows.filter((r) => r.status === "pending").length} pending payment</p>
        <p>₹{totalCollected.toLocaleString("en-IN")} collected</p>
        <p>{unnotified.length} awaiting notification</p>
      </div>

      <button
        type="button"
        onClick={notifyAll}
        disabled={notifying || unnotified.length === 0}
        className="mt-6 border border-ink bg-ink px-6 py-3 font-sans text-caption uppercase tracking-[0.1em] text-cream transition-colors hover:bg-cream hover:text-ink disabled:opacity-40"
      >
        {notifying ? "Sending…" : `Notify All — Drop Is Live (${unnotified.length})`}
      </button>
      {message && <p className="mt-3 text-caption text-secondary-text">{message}</p>}
      {error && <p className="mt-3 text-caption text-red-500">{error}</p>}

      <div className="mt-10">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-body-s text-secondary-text">No pre-orders yet.</p>
        ) : (
          <table className="w-full border-collapse text-body-s text-ink">
            <thead>
              <tr className="border-b border-divider text-left text-caption uppercase tracking-[0.05em] text-secondary-text">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Status</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Notified</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-divider">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">{r.email}</td>
                  <td className="py-2 capitalize">{r.status}</td>
                  <td className="py-2">₹{Number(r.amount_rupees).toLocaleString("en-IN")}</td>
                  <td className="py-2">{r.notified_at ? "Yes" : "—"}</td>
                  <td className="py-2">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
