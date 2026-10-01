"use client";

import { useEffect, useState } from "react";

type Row = { created_at: string; amount_paise: number | null; upi_ref: string | null; payer_name: string | null; status: string; matched_order_id: string | null };

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
  type Mail = { address: string | null; hasPassword: boolean; lastCheck: { at: string; ok: boolean; error?: string; processed?: number } | null };
  const [data, setData] = useState<{ url: string; recent: Row[]; mail: Mail } | null>(null);
  const [address, setAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/admin/bank-sms")
      .then((r) => r.json())
      .then((d) => {
        if (!d.url) return; // team logins don't see this panel
        setData(d);
        setAddress((a) => a || d.mail?.address || "");
      })
      .catch(() => {});
  }

  async function saveMail(action?: "check") {
    setBusy(true);
    try {
      await fetch("/api/admin/bank-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action ? { action } : { address, appPassword }),
      });
      setAppPassword("");
      load();
    } finally {
      setBusy(false);
    }
  }
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(load, []);

  if (!data) return null;
  return (
    <section className="mt-10 border border-divider p-5">
      <h2 className="font-display text-heading-s uppercase text-ink">UPI auto-confirm from bank alerts</h2>

      <div className="mt-3 border border-divider p-4">
        <p className="text-body-s font-bold text-ink">Bank alert email (Yahoo)</p>
        <p className="mt-1 max-w-2xl text-caption text-secondary-text">
          Checked every minute for new HDFC &ldquo;credited&rdquo; emails. Use a Yahoo <strong>app password</strong>
          (Yahoo Account → Account Security → Generate app password), not your normal password. Your inbox
          isn&apos;t changed: nothing is marked read or moved. The password can&apos;t be viewed again here.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="you@yahoo.co.in"
            className="w-60 border border-ink/30 bg-surface px-2 py-1 text-caption text-ink"
          />
          <input
            type="password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder={data.mail?.hasPassword ? "App password saved (enter to replace)" : "Yahoo app password"}
            autoComplete="off"
            className="w-64 border border-ink/30 bg-surface px-2 py-1 text-caption text-ink"
          />
          <button type="button" disabled={busy} onClick={() => saveMail()} className="border border-ink px-3 py-1 text-caption uppercase text-ink disabled:opacity-50">
            {busy ? "Connecting…" : "Save & connect"}
          </button>
          {data.mail?.hasPassword && (
            <button type="button" disabled={busy} onClick={() => saveMail("check")} className="border border-divider px-3 py-1 text-caption uppercase text-ink disabled:opacity-50">
              Check now
            </button>
          )}
        </div>
        {data.mail?.lastCheck && (
          <p className={`mt-2 text-caption ${data.mail.lastCheck.ok ? "text-secondary-text" : "text-paint-orange"}`}>
            Last check {new Date(data.mail.lastCheck.at).toLocaleString("en-IN")}:{" "}
            {data.mail.lastCheck.ok ? `connected, ${data.mail.lastCheck.processed ?? 0} new alert(s)` : `failed (${data.mail.lastCheck.error})`}
          </p>
        )}
      </div>

      <p className="mt-5 text-body-s font-bold text-ink">Or: forward bank SMS from your phone</p>
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
        <p className="text-caption uppercase tracking-[0.05em] text-secondary-text">Latest bank alerts (SMS or email)</p>
        {data.recent.length === 0 ? (
          <p className="mt-1 text-caption text-secondary-text">None yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-caption text-ink">
            {data.recent.map((r, i) => (
              <li key={i}>
                {new Date(r.created_at).toLocaleString("en-IN")} · {r.amount_paise != null ? `₹${(r.amount_paise / 100).toFixed(2)}` : "—"} ·{" "}
                {LABEL[r.status] ?? r.status}
                {r.matched_order_id ? ` · #${r.matched_order_id.slice(0, 8).toUpperCase()}` : ""}
                {r.payer_name ? ` · from ${r.payer_name}` : ""}
                {r.upi_ref ? ` · ref ${r.upi_ref}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
