"use client";

import { useEffect, useState } from "react";

type Row = { created_at: string; amount_paise: number | null; upi_ref: string | null; status: string; matched_order_id: string | null };

const LABEL: Record<string, string> = {
  confirmed: "Matched & confirmed",
  no_match: "No matching order",
  ambiguous: "More than one match (confirm by hand)",
  not_a_credit: "Not a credit SMS",
  bad_token: "Rejected: wrong link token (re-copy the link)",
  no_token: "Rejected: link is missing its token",
};

/** Set-up + log for UPI auto-confirm via forwarded bank credit SMS (see app/api/webhooks/bank-sms). */
export function BankSmsPanel() {
  const [data, setData] = useState<{ url: string; recent: Row[] } | null>(null);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/bank-sms")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;
  return (
    <section className="mt-10 border border-divider p-5">
      <h2 className="font-display text-heading-s uppercase text-ink">UPI auto-confirm from bank SMS</h2>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Forward every bank credit SMS to the private link below. A UPI order whose exact amount
        (rupees and paise) matches is confirmed automatically: stock, invoice, WhatsApp and Shiprocket,
        same as Mark Paid. Keep this link private; anyone with it could post fake messages.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="max-w-full break-all bg-surface-alt px-2 py-1 text-caption text-ink">
          {show ? data.url : data.url.replace(/token=.*/, "token=••••••••")}
        </code>
        <button type="button" onClick={() => setShow((s) => !s)} className="border border-divider px-3 py-1 text-caption uppercase text-ink">
          {show ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(data.url).then(() => setCopied(true))}
          className="border border-ink px-3 py-1 text-caption uppercase text-ink"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <details className="mt-3 text-caption text-secondary-text">
        <summary className="cursor-pointer text-ink">How to set it up on your phone</summary>
        <p className="mt-2">
          <strong>iPhone:</strong> Shortcuts → Automation → + → Message → Message Contains &ldquo;HDFC Bank&rdquo; (leave Sender empty) →
          Run Immediately, Notify When Run off. Action: &ldquo;Get Contents of URL&rdquo; → paste the link → Method POST → Request
          Body JSON → add field <code>text</code> = Shortcut Input (Message). Every HDFC SMS gets sent; only credits are kept.</p>
        <p className="mt-2">
          <strong>Android:</strong> install an SMS forwarder (e.g. &ldquo;SMS Forwarder&rdquo;), add a rule for your bank&apos;s
          sender ID that sends the message text by HTTP POST to the link.
        </p>
      </details>
      <div className="mt-4">
        <p className="text-caption uppercase tracking-[0.05em] text-secondary-text">Latest forwarded SMS</p>
        {data.recent.length === 0 ? (
          <p className="mt-1 text-caption text-secondary-text">None yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-caption text-ink">
            {data.recent.map((r, i) => (
              <li key={i}>
                {new Date(r.created_at).toLocaleString("en-IN")} · {r.amount_paise != null ? `₹${(r.amount_paise / 100).toFixed(2)}` : "—"} ·{" "}
                {LABEL[r.status] ?? r.status}
                {r.matched_order_id ? ` · #${r.matched_order_id.slice(0, 8).toUpperCase()}` : ""}
                {r.upi_ref ? ` · ref ${r.upi_ref}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
