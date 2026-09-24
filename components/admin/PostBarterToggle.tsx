"use client";

import { useEffect, useState } from "react";

export function PostBarterToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/post-barter/toggle")
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setError("Could not load the current state"));
  }, []);

  async function flip() {
    if (enabled === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/post-barter/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setEnabled(data.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 border border-ink/30 p-4">
      <button
        type="button"
        role="switch"
        aria-checked={!!enabled}
        disabled={enabled === null || saving}
        onClick={flip}
        className={`relative h-7 w-12 shrink-0 border transition-colors duration-200 disabled:opacity-50 ${
          enabled ? "border-ink bg-ink" : "border-ink/30 bg-surface"
        }`}
      >
        <span
          className={`absolute top-1 h-[18px] w-[18px] transition-all duration-200 ${
            enabled ? "left-[26px] bg-cream" : "left-1 bg-ink/40"
          }`}
        />
      </button>
      <div>
        <p className="font-sans text-body-s font-bold uppercase tracking-[0.03em] text-ink">
          {enabled === null ? "Loading…" : enabled ? "On — live on the site" : "Off — hidden from the site"}
        </p>
        <p className="text-caption text-secondary-text">
          Off hides the homepage banner and product/cart/checkout options, and stops new applications. Orders already
          placed keep qualifying and shipping as normal.
        </p>
        {error && <p className="text-caption text-paint-orange">{error}</p>}
      </div>
    </div>
  );
}
