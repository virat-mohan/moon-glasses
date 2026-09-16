"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CountdownTimer } from "@/components/countdown/CountdownTimer";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function PreorderPage() {
  const [dropDateIso, setDropDateIso] = useState<string | null>(null);
  const [dropDateLabel, setDropDateLabel] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState<"idle" | "paying" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [amountRupees, setAmountRupees] = useState(500);

  useEffect(() => {
    fetch("/api/preorder/meta")
      .then((r) => r.json())
      .then((d) => {
        setDropDateIso(d.dropDateIso);
        setDropDateLabel(d.dropDateLabel);
        setAmountRupees(d.amountRupees);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError("Enter your name and a valid email");
      return;
    }

    setStatus("paying");
    try {
      const createRes = await fetch("/api/preorder/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Could not start pre-order");

      const rzp = new window.Razorpay({
        key: createData.keyId,
        order_id: createData.razorpayOrderId,
        amount: Math.round(createData.amountRupees * 100),
        currency: "INR",
        name: "Moonglasses",
        description: "Pre-order deposit",
        prefill: { name: form.name, email: form.email, contact: form.phone },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/preorder/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            setStatus("done");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment verification failed");
            setStatus("idle");
          }
        },
        modal: { ondismiss: () => setStatus("idle") },
        theme: { color: "#000000" },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start pre-order");
      setStatus("idle");
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <main className="mx-auto flex min-h-[70vh] w-full max-w-[600px] flex-col items-center px-6 pt-32 pb-24 text-center md:pt-40">
        <p className="font-sans text-micro uppercase tracking-[0.3em] text-secondary-text">
          Reserve Your Spot
        </p>
        <h1 className="mt-4 font-sans text-heading-xl text-white">Pre-Order Now</h1>
        <p className="mt-4 max-w-md font-sans text-body-s text-secondary-text">
          Pay a ₹{amountRupees.toLocaleString("en-IN")} deposit to lock in first access. It&rsquo;s
          fully credited toward your order the moment the collection drops — you just get to shop
          before everyone else.
        </p>

        {dropDateIso && (
          <div className="mt-10">
            <CountdownTimer targetIso={dropDateIso} label={`Drops ${dropDateLabel}`} />
          </div>
        )}

        {status === "done" ? (
          <div className="mt-12 border border-white/25 px-8 py-10">
            <p className="font-sans text-body text-white">You&rsquo;re in.</p>
            <p className="mt-2 font-sans text-body-s text-secondary-text">
              Check your email for confirmation — we&rsquo;ll notify you the second the collection
              goes live.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-12 flex w-full flex-col gap-4 text-left">
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-white/25 bg-transparent px-4 py-3 font-sans text-body-s text-white placeholder:text-secondary-text focus:border-white focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border border-white/25 bg-transparent px-4 py-3 font-sans text-body-s text-white placeholder:text-secondary-text focus:border-white focus:outline-none"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border border-white/25 bg-transparent px-4 py-3 font-sans text-body-s text-white placeholder:text-secondary-text focus:border-white focus:outline-none"
            />

            {error && <p className="font-sans text-caption text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={status === "paying"}
              className="mt-2 border border-white bg-white px-10 py-4 font-sans text-body-s uppercase tracking-[0.15em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-60"
            >
              {status === "paying" ? "Opening payment…" : `Pay ₹${amountRupees.toLocaleString("en-IN")} & Reserve`}
            </button>
          </form>
        )}
      </main>
      <FooterEditorial />
    </>
  );
}
