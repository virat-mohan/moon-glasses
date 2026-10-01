"use client";

import { useEffect, useState } from "react";

type Row = { created_at: string; amount_paise: number | null; upi_ref: string | null; payer_name: string | null; status: string; matched_order_id: string | null };

const LABEL: Record<string, string> = {
  confirmed: "Matched & confirmed",
  already_confirmed: "Duplicate alert (order already confirmed)",
  no_match: "No matching order",
  ambiguous: "More than one match (confirm by hand)",
  not_a_credit: "Not a credit SMS",
  bad_token: "Rejected: wrong link token (re-copy the link)",
  no_token: "Rejected: link is missing its token",
};

/** Set-up + log for UPI auto-confirm via forwarded bank credit SMS (see app/api/webhooks/bank-sms). */
export function BankSmsPanel() {
  type Mailbox = { address: string; lastCheck: { at: string; ok: boolean; error?: string; processed?: number } | null };
  const [data, setData] = useState<{ url: string; recent: Row[]; mailboxes: Mailbox[]; whatsappInboundUrl?: string } | null>(null);
  const [inboundCopied, setInboundCopied] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/admin/bank-sms")
      .then((r) => r.json())
      .then((d) => {
        if (!d.url) return; // team logins don't see this panel
        setData(d);
      })
      .catch(() => {});
  }

  async function saveMail(payload: Record<string, string>) {
    setBusy(true);
    setMailError(null);
    try {
      const res = await fetch("/api/admin/bank-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) setMailError(out.error ?? "Could not save");
      else if (!payload.action) {
        setAddress("");
        setAppPassword("");
      }
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
      {data.whatsappInboundUrl && (
        <div className="mb-6 border border-divider p-4">
          <p className="text-body-s font-bold text-ink">WhatsApp incoming messages (MSG91)</p>
          <p className="mt-1 max-w-2xl text-caption text-secondary-text">
            Paste this in MSG91 → WhatsApp → your number → Webhook (inbound / incoming messages). It powers the
            &ldquo;Get my post on WhatsApp&rdquo; auto-reply. Keep it private.
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(data.whatsappInboundUrl!).then(() => setInboundCopied(true))}
            className="mt-2 border border-ink px-3 py-1 text-caption uppercase text-ink"
          >
            {inboundCopied ? "Copied" : "Copy inbound webhook link"}
          </button>
        </div>
      )}

      <h2 className="font-display text-heading-s uppercase text-ink">UPI auto-confirm from bank alerts</h2>

      <div className="mt-3 border border-divider p-4">
        <p className="text-body-s font-bold text-ink">Bank alert emails (Gmail / Yahoo)</p>
        <p className="mt-1 max-w-2xl text-caption text-secondary-text">
          Each inbox is checked every minute for new HDFC &ldquo;credited&rdquo; emails. Use an <strong>app password</strong>,
          not your normal password (Yahoo: Account Security → Generate app password; Gmail: myaccount.google.com →
          Security → 2-Step Verification → App passwords). Nothing in the inbox is marked read or moved, and saved
          passwords can&apos;t be viewed again.
        </p>
        {data.mailboxes.length > 0 && (
          <ul className="mt-3 space-y-1 text-caption text-ink">
            {data.mailboxes.map((m) => (
              <li key={m.address} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{m.address}</span>
                <span className={m.lastCheck && !m.lastCheck.ok ? "text-paint-orange" : "text-secondary-text"}>
                  {m.lastCheck
                    ? `${m.lastCheck.ok ? "connected" : `failed: ${m.lastCheck.error}`} · checked ${new Date(m.lastCheck.at).toLocaleString("en-IN")}`
                    : "not checked yet"}
                </span>
                <button type="button" onClick={() => saveMail({ action: "remove", address: m.address })} className="underline text-secondary-text">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="inbox that gets bank alerts"
            className="w-60 border border-ink/30 bg-surface px-2 py-1 text-caption text-ink"
          />
          <input
            type="password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder="App password"
            autoComplete="off"
            className="w-48 border border-ink/30 bg-surface px-2 py-1 text-caption text-ink"
          />
          <button type="button" disabled={busy} onClick={() => saveMail({ address, appPassword })} className="border border-ink px-3 py-1 text-caption uppercase text-ink disabled:opacity-50">
            {busy ? "Connecting…" : "Add inbox"}
          </button>
          {data.mailboxes.length > 0 && (
            <button type="button" disabled={busy} onClick={() => saveMail({ action: "check" })} className="border border-divider px-3 py-1 text-caption uppercase text-ink disabled:opacity-50">
              Check now
            </button>
          )}
        </div>
        {mailError && <p className="mt-2 text-caption text-paint-orange">{mailError}</p>}
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
