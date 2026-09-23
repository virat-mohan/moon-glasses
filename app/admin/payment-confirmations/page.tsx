"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ConfirmationRow = {
  id: string;
  phone: string;
  media_url: string | null;
  extracted_amount_rupees: number | null;
  extracted_utr: string | null;
  extracted_payee: string | null;
  matched_order_id: string | null;
  match_status: string;
  note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  auto_confirmed: "Auto-Confirmed",
  needs_review: "Needs Review",
  no_match: "No Matching Order",
  not_a_payment_screenshot: "Not A Payment Screenshot",
  extraction_failed: "Extraction Failed",
};

function money(n: number | null) {
  return n == null ? "—" : `₹${n.toLocaleString("en-IN")}`;
}

export default function PaymentConfirmationsPage() {
  const [rows, setRows] = useState<ConfirmationRow[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/payment-confirmations")
      .then((res) => res.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => setError("Could not load payment confirmations"));
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(orderId: string) {
    setConfirming(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-upi-paid`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not confirm payment");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm payment");
    } finally {
      setConfirming(null);
    }
  }

  const needsReview = (rows ?? []).filter((r) => r.match_status === "needs_review");
  const rest = (rows ?? []).filter((r) => r.match_status !== "needs_review");

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="font-display text-heading-l uppercase text-ink">WhatsApp Payment Confirmations</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Every screenshot sent to the WhatsApp Business number is logged here. A payment only auto-confirms when the
        sender&apos;s phone, the extracted amount, and the extracted UTR all line up with exactly one pending order —
        anything less certain lands below for a manual check.
      </p>

      {error && <p className="mt-4 text-body-s text-paint-orange">{error}</p>}

      {rows === null ? (
        <p className="mt-10 text-body-s text-secondary-text">Loading…</p>
      ) : (
        <>
          <h2 className="mt-10 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
            Needs Review ({needsReview.length})
          </h2>
          {needsReview.length === 0 ? (
            <p className="mt-2 text-body-s text-secondary-text">Nothing waiting on a manual check.</p>
          ) : (
            <div className="mt-3 border border-ink/30">
              {needsReview.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-4 border-b border-ink/10 p-4 last:border-b-0">
                  <div className="min-w-[160px]">
                    <p className="font-sans text-body-s font-bold text-ink">{r.phone}</p>
                    <p className="text-caption text-secondary-text">{new Date(r.created_at).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="text-body-s text-ink">
                    {money(r.extracted_amount_rupees)} · UTR {r.extracted_utr ?? "—"}
                  </div>
                  <p className="max-w-md flex-1 text-caption text-secondary-text">{r.note}</p>
                  {r.media_url && (
                    <a href={r.media_url} target="_blank" rel="noreferrer" className="text-caption text-ink underline">
                      View Screenshot
                    </a>
                  )}
                  {r.matched_order_id && (
                    <>
                      <Link href={`/admin/orders`} className="text-caption text-ink underline">
                        View Order
                      </Link>
                      <button
                        onClick={() => markPaid(r.matched_order_id!)}
                        disabled={confirming === r.matched_order_id}
                        className="border border-ink px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-60"
                      >
                        {confirming === r.matched_order_id ? "Confirming…" : "Confirm This Order"}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 className="mt-10 font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">All Attempts</h2>
          <div className="mt-3 overflow-x-auto border border-ink/30">
            <table className="w-full text-body-s">
              <thead>
                <tr className="border-b border-ink/20 text-left text-caption uppercase tracking-[0.05em] text-secondary-text">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">UTR</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((r) => (
                  <tr key={r.id} className="border-b border-ink/10 text-secondary-text">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2">{r.phone}</td>
                    <td className={`px-3 py-2 ${r.match_status === "auto_confirmed" ? "text-ink font-bold" : ""}`}>
                      {STATUS_LABEL[r.match_status] ?? r.match_status}
                    </td>
                    <td className="px-3 py-2">{money(r.extracted_amount_rupees)}</td>
                    <td className="px-3 py-2">{r.extracted_utr ?? "—"}</td>
                    <td className="px-3 py-2">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
