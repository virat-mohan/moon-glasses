"use client";

import { useState } from "react";

export function MarkUpiPaidButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "confirming" | "done" | "error">("idle");

  async function confirm() {
    if (!window.confirm("Confirm you've actually seen this UPI payment land in your account?")) return;
    setState("confirming");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-upi-paid`, { method: "POST" });
      if (!res.ok) throw new Error();
      setState("done");
      window.location.reload();
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <span className="text-micro text-tan-gold">Paid ✓</span>;

  return (
    <button
      onClick={confirm}
      disabled={state === "confirming"}
      className="border border-ink px-2 py-1 font-sans text-micro font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
    >
      {state === "confirming" ? "Confirming…" : state === "error" ? "Retry Mark Paid" : "Mark Paid"}
    </button>
  );
}
