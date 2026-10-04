"use client";

import { useState } from "react";
import { ActionTile } from "./ActionTile";

export function SendPaymentLinkButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function send() {
    if (!window.confirm("Send direct WhatsApp payment link to customer?")) return;
    setState("sending");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/send-payment-link`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to send");
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      setState("error");
    }
  }

  if (state === "done") return <span className="ord-ok">WhatsApp Sent ✓</span>;

  return (
    <ActionTile hint="Sends WhatsApp payment link (/pay/...) so the customer can complete their UPI payment.">
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="ord-btn"
      >
        {state === "sending"
          ? "Sending WhatsApp…"
          : state === "error"
            ? `Retry: Send Payment Link (${errorMsg ?? "error"})`
            : "Send WhatsApp Payment Link"}
      </button>
    </ActionTile>
  );
}
