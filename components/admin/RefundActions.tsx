"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionTile } from "./ActionTile";

function isPrePickup(status: string | null | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return !/in_transit|shipped|picked_up|out_for_delivery|delivered|rto/.test(s);
}

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
  const canCancel = !cancelled && isPrePickup(shipmentStatus);

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
    <>
      {canCancel && (
        <ActionTile hint="Cancels before pickup, refunds the customer in full and puts the stock back. Cannot be undone.">
          <button type="button" onClick={cancelOrder} disabled={cancelling} className="ord-btn ord-btn--danger">
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        </ActionTile>
      )}
      {hasRazorpayPayment && maxRefundable > 0 && (
        <ActionTile hint="Sends part or all of the money back to the customer's original payment method. You choose the amount.">
          <button type="button" onClick={refund} disabled={refunding} className="ord-btn">
            {refunding ? "Refunding…" : `Refund${refunded > 0 ? ` (₹${refunded} done)` : ""}`}
          </button>
        </ActionTile>
      )}
      {returnScheduled ? (
        <p className="ord-muted">Return pickup scheduled</p>
      ) : (
        <ActionTile hint="Asks the courier to collect the parcel back from the customer.">
          <button type="button" onClick={scheduleReturn} disabled={schedulingReturn} className="ord-btn">
            {schedulingReturn ? "Scheduling…" : "Schedule return pickup"}
          </button>
        </ActionTile>
      )}
      {hasRazorpayPayment && (
        <ActionTile hint="Re-reads the payment and refund amounts from Razorpay if they look out of date.">
          <button type="button" onClick={syncFromRazorpay} disabled={syncing} className="ord-btn">
            {syncing ? "Syncing…" : "Sync from Razorpay"}
          </button>
        </ActionTile>
      )}
      {error && <p className="ord-err ord-span">{error}</p>}
    </>
  );
}
