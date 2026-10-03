"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionTile } from "./ActionTile";

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
      <ActionTile
        hint="Creates the Shiprocket shipment for this order. It normally happens by itself once paid, so use this to retry."
        feedback={error ? <p className="ord-err">{error}</p> : undefined}
      >
        <button type="button" onClick={ship} disabled={busy} className="ord-btn">
          {busy ? "Booking…" : "Book shipping"}
        </button>
      </ActionTile>
    );
  }

  return (
    <div className="ord-ship-live">
      <p className="ord-val">
        {state.courierName ?? "Waiting for courier"}
        {state.awbCode && <> · AWB {state.awbCode}</>}
      </p>
      {state.shiprocketOrderId && <p className="ord-muted">Shiprocket order #{state.shiprocketOrderId}</p>}
      <button type="button" onClick={track} disabled={busy} className="ord-link">
        {busy ? "Checking…" : "Check tracking now"}
      </button>
      {warning && <p className="ord-err">{warning}</p>}
      {error && <p className="ord-err">{error}</p>}
    </div>
  );
}
