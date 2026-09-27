"use client";

import { useEffect, useState } from "react";

type Result = { name: string; ok: boolean; detail: string };
type Status = { name: string; status: string };

export function WhatsAppTemplatesPanel() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatuses() {
    const res = await fetch("/api/admin/whatsapp/templates");
    const data = await res.json().catch(() => null);
    if (Array.isArray(data?.templates)) setStatuses(data.templates);
  }

  useEffect(() => {
    fetch("/api/admin/whatsapp/templates")
      .then((res) => res.json())
      .then((data) => Array.isArray(data?.templates) && setStatuses(data.templates))
      .catch(() => {});
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not create templates");
      setResults(data.results);
      setNamespace(data.namespace);
      await loadStatuses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create templates");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 border border-divider p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-body-s font-bold text-ink">WhatsApp message templates</p>
          <p className="text-caption text-secondary-text">
            Submits every order, delivery and Pay With A Post template to MSG91 for Meta approval and fills in their names in
            Settings. Safe to run again.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="border border-ink px-4 py-2 text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Create templates in MSG91"}
        </button>
      </div>

      {error && <p className="mt-3 text-caption text-paint-orange">{error}</p>}
      {namespace && <p className="mt-3 text-caption text-secondary-text">Namespace saved.</p>}

      {results && (
        <ul className="mt-4 space-y-1 text-caption">
          {results.map((r) => (
            <li key={r.name} className={r.ok ? "text-ink" : "text-paint-orange"}>
              {r.ok ? "✓" : "✗"} {r.name}: {r.detail}
            </li>
          ))}
        </ul>
      )}

      {statuses.length > 0 && (
        <div className="mt-4 border-t border-divider pt-3">
          <p className="text-caption uppercase tracking-[0.05em] text-secondary-text">Approval status in MSG91</p>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-caption sm:grid-cols-2">
            {statuses.map((s) => (
              <li key={s.name} className="text-ink">
                {s.name}: <span className="text-secondary-text">{s.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
