"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CANCELLABLE_SHIPMENT_STATUSES = new Set(["not_shipped", "processing"]);

export function RefundActions({
  orderId,
  total,
  refundedAmount,
  hasRazorpayPayment,
  returnShipmentId,
  status,
  shipmentStatus,
}: {
  orderId: string;
  total: number;
  refundedAmount: number;
  hasRazorpayPayment: boolean;
  returnShipmentId: string | null;
  status: string;
  shipmentStatus: string;
}) {
  const router = useRouter();
  const [refunding, setRefunding] = useState(false);
  const [schedulingReturn, setSchedulingReturn] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refunded, setRefunded] = useState(refundedAmount);
  const [returnScheduled, setReturnScheduled] = useState(!!returnShipmentId);
  const [cancelled, setCancelled] = useState(status === "cancelled");
  const [error, setError] = useState<string | null>(null);

  const maxRefundable = total - refunded;
  const canCancel = !cancelled && CANCELLABLE_SHIPMENT_STATUSES.has(shipmentStatus);

  async function refund() {
    if (maxRefundable <= 0) return;
    const input = window.prompt(`Refund how much? (max ₹${maxRefundable})`, String(maxRefundable));
    if (input === null) return;
    const amount = Number(input);
    if (!amount || amount <= 0 || amount > maxRefundable) {
      setError(`Enter an amount between ₹1 and ₹${maxRefundable}.`);
      return;
    }
    if (!window.confirm(`Refund ₹${amount} to the customer's original payment method? This can't be undone.`)) {
      return;
    }
    setRefunding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRupees: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      setRefunded((prev) => prev + data.amountRupees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  }

  async function scheduleReturn() {
    if (!window.confirm("Schedule a courier pickup from the customer's address for this return?")) return;
    setSchedulingReturn(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/return-pickup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not schedule pickup");
      setReturnScheduled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule pickup");
    } finally {
      setSchedulingReturn(false);
    }
  }

  async function cancelOrder() {
    if (!window.confirm("Cancel this order? This refunds it in full and puts stock back — this can't be undone.")) {
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel order");
      setCancelled(true);
      if (data.refundedRupees > 0) setRefunded((prev) => prev + data.refundedRupees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel order");
    } finally {
      setCancelling(false);
    }
  }

  async function syncFromRazorpay() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/sync-payment`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sync from Razorpay");
      setRefunded(data.refundedRupees);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync from Razorpay");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {canCancel && (
        <button
          onClick={cancelOrder}
          disabled={cancelling}
          className="border border-paint-orange px-2 py-1 text-micro uppercase tracking-[0.05em] text-paint-orange hover:bg-paint-orange hover:text-cream disabled:opacity-50"
        >
          {cancelling ? "..." : "Cancel Order"}
        </button>
      )}
      {hasRazorpayPayment && maxRefundable > 0 && (
        <button
          onClick={refund}
          disabled={refunding}
          className="border border-ink px-2 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {refunding ? "..." : `Refund${refunded > 0 ? ` (₹${refunded} done)` : ""}`}
        </button>
      )}
      {returnScheduled ? (
        <span className="text-micro text-secondary-text">Return pickup scheduled</span>
      ) : (
        <button
          onClick={scheduleReturn}
          disabled={schedulingReturn}
          className="text-micro text-secondary-text underline disabled:opacity-50"
        >
          {schedulingReturn ? "..." : "Schedule Return Pickup"}
        </button>
      )}
      {hasRazorpayPayment && (
        <button
          onClick={syncFromRazorpay}
          disabled={syncing}
          className="text-micro text-secondary-text underline disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync from Razorpay"}
        </button>
      )}
      {error && <p className="max-w-[160px] text-micro text-paint-orange">{error}</p>}
    </div>
  );
}
