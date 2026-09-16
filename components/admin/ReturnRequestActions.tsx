"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReturnRequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!window.confirm("Approve this return? This schedules a Shiprocket pickup from the customer's address.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not approve");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setBusy(false);
    }
  }

  async function deny() {
    const denialReason = window.prompt("Reason for denying this return?");
    if (denialReason === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deny", denialReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not deny");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deny");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          onClick={approve}
          disabled={busy}
          className="border border-ink px-2 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={deny}
          disabled={busy}
          className="border border-paint-orange px-2 py-1 text-micro uppercase tracking-[0.05em] text-paint-orange hover:bg-paint-orange hover:text-cream disabled:opacity-50"
        >
          Deny
        </button>
      </div>
      {error && <p className="max-w-[180px] text-micro text-paint-orange">{error}</p>}
    </div>
  );
}
