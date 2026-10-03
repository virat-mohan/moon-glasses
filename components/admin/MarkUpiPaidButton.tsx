"use client";

import { useState } from "react";
import { ActionTile } from "./ActionTile";

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

  if (state === "done") return <span className="ord-ok">Paid ✓</span>;

  return (
    <ActionTile hint="Only after you have seen the money arrive in your account. Confirms payment and releases the order for shipping.">
      <button type="button" onClick={confirm} disabled={state === "confirming"} className="ord-btn ord-btn--solid">
        {state === "confirming" ? "Confirming…" : state === "error" ? "Retry: Mark paid" : "Mark paid"}
      </button>
    </ActionTile>
  );
}
