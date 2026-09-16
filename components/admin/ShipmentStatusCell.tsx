"use client";

import { useState } from "react";

const MANUAL_OPTIONS = ["Shipped", "Delivered", "Cancelled"];

/**
 * Manual, record-keeping-only override of the shipment status label — for
 * orders shipped outside the normal Shiprocket flow, or while tracking
 * lags. Deliberately does NOT route through applyShipmentStatusUpdate()
 * (lib/shiprocket-status.ts): Shiprocket's own webhook/tracking sweep stays
 * the sole trigger for the review-request nudge, refunds, and restocking,
 * so picking "Delivered" or "Cancelled" here can never double-fire any of
 * that if the real webhook later reports the same transition. Any COD
 * advance already collected is forfeited on cancellation per policy, not
 * auto-refunded from here either way.
 */
export function ShipmentStatusCell({ orderId, currentLabel }: { orderId: string; currentLabel: string }) {
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(currentLabel);

  async function update(next: string) {
    if (!next) return;
    setLabel(next);
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentStatus: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-secondary-text">{label}</span>
      <select
        value=""
        onChange={(e) => update(e.target.value)}
        disabled={saving}
        className="border border-divider bg-surface px-1.5 py-1 font-sans text-micro text-ink"
      >
        <option value="">Mark as...</option>
        {MANUAL_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
