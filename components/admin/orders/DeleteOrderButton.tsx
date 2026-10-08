"use client";

import { useState } from "react";

export function DeleteOrderButton({
  orderId,
  orderShortId,
  customerName,
  label = "Delete order",
  className = "ord-btn ord-btn--danger",
  style,
}: {
  orderId: string;
  orderShortId: string;
  customerName: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const message = `Are you sure you want to delete order #${orderShortId} (${customerName})? This action cannot be undone.`;
    if (!window.confirm(message)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete order");
        setDeleting(false);
      }
    } catch {
      alert("Error deleting order");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={deleting}
      onClick={handleDelete}
      aria-label={`Delete order ${orderShortId}`}
    >
      {deleting ? "Deleting…" : label}
    </button>
  );
}
