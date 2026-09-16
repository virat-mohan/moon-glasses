"use client";

import { useState } from "react";

const OPTIONS: Record<string, string[]> = {
  status: ["pending_whatsapp_confirmation", "confirmed", "cancelled"],
};

export function OrderStatusCell({
  orderId,
  field,
  value,
}: {
  orderId: string;
  field: "status";
  value: string;
}) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);

  async function update(next: string) {
    setCurrent(next);
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={current}
      onChange={(e) => update(e.target.value)}
      disabled={saving}
      className="border border-divider bg-surface px-2 py-1 font-sans text-caption text-ink"
    >
      {OPTIONS[field].map((o) => (
        <option key={o} value={o}>
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
