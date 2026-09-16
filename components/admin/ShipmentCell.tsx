"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShipmentCell({
  orderId,
  shiprocketOrderId,
  shipmentId,
  awbCode,
  courierName,
}: {
  orderId: string;
  shiprocketOrderId: string | null;
  shipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [state, setState] = useState({ shiprocketOrderId, shipmentId, awbCode, courierName });

  async function ship() {
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ship`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not ship");
      setState((s) => ({
        ...s,
        shipmentId: data.shipmentId,
        shiprocketOrderId: data.shiprocketOrderId ?? s.shiprocketOrderId,
        awbCode: data.awbCode ?? s.awbCode,
        courierName: data.courierName ?? s.courierName,
      }));
      if (data.courierWarning) setWarning(data.courierWarning);
      // The row's shipment-status cell is a separate, read-only server-rendered
      // cell — a plain client-state update here wouldn't touch it. Refreshing
      // the server component is what actually syncs it to "processing".
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ship");
    } finally {
      setBusy(false);
    }
  }

  async function track() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/track`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not check tracking");
      setState((s) => ({ ...s, awbCode: data.awbCode ?? s.awbCode, courierName: data.courierName ?? s.courierName }));
      // The shipment-status cell is a separate, read-only server-rendered
      // cell — a refresh here is what syncs it to what this call just wrote.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check tracking");
    } finally {
      setBusy(false);
    }
  }

  if (!state.shipmentId) {
    return (
      <div>
        <button
          onClick={ship}
          disabled={busy}
          className="border border-ink px-2 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {busy ? "..." : "Ship"}
        </button>
        {error && <p className="mt-1 max-w-[160px] text-micro text-paint-orange">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-caption text-secondary-text">
        {state.courierName ?? "Awaiting courier"}
        {state.awbCode && <> · {state.awbCode}</>}
      </p>
      {state.shiprocketOrderId && (
        <p className="text-micro text-secondary-text">SR #{state.shiprocketOrderId}</p>
      )}
      <button
        onClick={track}
        disabled={busy}
        className="mt-1 text-micro text-secondary-text underline disabled:opacity-50"
      >
        {busy ? "Checking..." : "Refresh Tracking"}
      </button>
      {warning && <p className="mt-1 max-w-[180px] text-micro text-paint-orange">{warning}</p>}
      {error && <p className="mt-1 max-w-[160px] text-micro text-paint-orange">{error}</p>}
    </div>
  );
}
