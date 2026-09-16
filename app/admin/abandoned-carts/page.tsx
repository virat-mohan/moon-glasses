"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: { name: string; quantity: number }[] | null;
  subtotal: number;
  status: string;
  retargeted_at: string | null;
  last_activity_at: string;
  abandon_reason: string | null;
  abandon_reason_note: string | null;
  abandon_reason_at: string | null;
  last_whatsapp_sent_at: string | null;
  last_email_sent_at: string | null;
};

const REASON_LABELS: Record<string, string> = {
  price: "Price too high",
  designs: "Not excited about designs",
  technical: "Technical/website issue",
  later: "Will buy later",
  other: "Other",
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

const REASON_ORDER = ["price", "designs", "technical", "later", "other"];

export default function AbandonedCartsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reasonCounts, setReasonCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [resultById, setResultById] = useState<Record<string, string>>({});
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const qs = params.toString();
    fetch(`/api/admin/abandoned-carts${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setSessions(data.sessions ?? []);
        setReasonCounts(data.reasonCounts ?? {});
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [fromDate, toDate]);

  async function sendTo(session: Session) {
    setSendingId(session.id);
    setResultById((prev) => ({ ...prev, [session.id]: "" }));
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${session.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send");
      const channels = [data.whatsappSent && "WhatsApp", data.emailSent && "email"].filter(Boolean).join(" + ");
      setResultById((prev) => ({ ...prev, [session.id]: `Sent via ${channels}` }));
      load();
    } catch (err) {
      setResultById((prev) => ({ ...prev, [session.id]: err instanceof Error ? err.message : "Could not send" }));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Abandoned Carts</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Every active or abandoned cart, most recent first. Use &quot;Send Nudge&quot; to retarget
        one specific session directly — e.g. to test the flow against your own cart — instead of
        running the sweep on /admin/reports, which touches every stale session at once.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-[0.05em] text-secondary-text">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-divider bg-surface px-2 py-1.5 text-caption text-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-[0.05em] text-secondary-text">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-divider bg-surface px-2 py-1.5 text-caption text-ink"
          />
        </label>
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-ink"
          >
            Clear range
          </button>
        )}
      </div>

      {!loading && Object.keys(reasonCounts).length > 0 && (
        <div className="mt-8 border-t border-divider pt-8">
          <p className="mb-4 text-caption uppercase tracking-[0.05em] text-secondary-text">
            Why Customers Didn&apos;t Buy — {Object.values(reasonCounts).reduce((a, b) => a + b, 0)} responses
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {REASON_ORDER.map((reason) => (
              <div key={reason} className="border border-divider p-4">
                <p className="font-display text-heading-m text-ink">{reasonCounts[reason] ?? 0}</p>
                <p className="mt-1 text-caption text-secondary-text">{REASON_LABELS[reason]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Last Active</th>
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Contact</th>
              <th className="py-2 pr-4">Items</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">WhatsApp Sent</th>
              <th className="py-2 pr-4">Email Sent</th>
              <th className="py-2 pr-4">Why Not (Customer)</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-body-s text-secondary-text">
                  No active or abandoned carts right now.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="border-b border-divider align-top">
                  <td className="py-3 text-caption text-secondary-text">{formatDate(s.last_activity_at)}</td>
                  <td className="py-3 font-sans text-body-s text-ink">{s.customer_name || "—"}</td>
                  <td className="py-3 text-caption text-secondary-text">
                    {s.customer_email || "—"}
                    {s.customer_phone && <div>{s.customer_phone}</div>}
                  </td>
                  <td className="py-3 text-caption text-secondary-text">
                    {(s.items ?? []).map((i) => `${i.name} x${i.quantity}`).join(", ")}
                    <div>₹{s.subtotal?.toLocaleString("en-IN")}</div>
                  </td>
                  <td className="py-3 text-caption text-secondary-text">{s.status}</td>
                  <td className="py-3 text-caption text-secondary-text">
                    {s.last_whatsapp_sent_at ? formatDate(s.last_whatsapp_sent_at) : "—"}
                  </td>
                  <td className="py-3 text-caption text-secondary-text">
                    {s.last_email_sent_at ? formatDate(s.last_email_sent_at) : "—"}
                  </td>
                  <td className="py-3 text-caption text-secondary-text">
                    {s.abandon_reason ? (
                      <>
                        <div className="text-ink">{REASON_LABELS[s.abandon_reason] ?? s.abandon_reason}</div>
                        {s.abandon_reason_note && <div className="italic">&quot;{s.abandon_reason_note}&quot;</div>}
                        {s.abandon_reason_at && <div>{formatDate(s.abandon_reason_at)}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => sendTo(s)}
                      disabled={sendingId === s.id}
                      className="border border-ink px-3 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
                    >
                      {sendingId === s.id ? "Sending..." : "Send Nudge"}
                    </button>
                    {resultById[s.id] && (
                      <p className="mt-1 text-micro text-secondary-text">{resultById[s.id]}</p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
