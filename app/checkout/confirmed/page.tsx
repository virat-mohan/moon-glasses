"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";

type OrderSummary = {
  id: string;
  customer_name: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  referral_discount_amount: number;
  shipping_charge: number;
  payment_type: string;
  cod_advance_amount: number;
  balance_due: number;
  payment_status: string;
  delivery_address: string;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_pincode: string | null;
};

type OrderItem = { chapter_name: string; unit_price: number; quantity: number };

export default function OrderConfirmedPage() {
  const [orderId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("order")
  );
  const [paid] = useState(() =>
    typeof window === "undefined" ? false : new URLSearchParams(window.location.search).get("paid") === "1"
  );
  const [barter] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const required = params.get("required");
    const tier = params.get("tier") === "gift_first" ? "gift_first" : "sell_first";
    return code ? { code, required: required ? Number(required) : 3, tier: tier as "gift_first" | "sell_first" } : null;
  });
  const [upiPending] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upi") !== "1") return null;
    return {
      amount: Number(params.get("amount") ?? 0),
      upiId: params.get("upiId") ?? "",
      qrImageUrl: params.get("qr") ?? "",
      upiLink: params.get("link") ?? "",
    };
  });
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const [friend, setFriend] = useState({ name: "", phone: "", email: "" });
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    // Landing here scrolled halfway down the page (carried over from
    // checkout's own scroll position) reads as broken — the confirmation
    // needs to open at the top every time.
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    // orderId/paid are read from window.location via lazy useState
    // initializers above (avoids a Suspense boundary from useSearchParams,
    // same reasoning as the attribution/referral capture in
    // lib/client-tracking.ts) — this effect only handles the data fetches.
    const id = orderId;

    if (!id) {
      fetch("/api/account/me")
        .then((res) => res.json())
        .then((data) => setReferralCode(data.referralCode ?? null))
        .catch(() => {});
      return;
    }

    fetch(`/api/orders/${id}/summary`)
      .then((res) => res.json())
      .then((data) => {
        if (data.order) setOrder(data.order);
        if (data.items) setItems(data.items);
      })
      .catch(() => {});

    fetch(`/api/orders/${id}/referral-code`)
      .then((res) => res.json())
      .then((data) => setReferralCode(data.referralCode ?? null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/refer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendName: friend.name, friendPhone: friend.phone, friendEmail: friend.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the invite");
      setSendResult(`Sent! ${friend.name} will hear from us shortly.`);
      setFriend({ name: "", phone: "", email: "" });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send the invite");
    } finally {
      setSending(false);
    }
  }

  const fullAddress = order
    ? [order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_pincode]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <>
      <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
          {upiPending ? "Awaiting Payment" : barter ? <PayWithAPostMark /> : paid ? "Order Confirmed" : "Order Sent"}
        </p>
        <CheckoutSteps current="confirmed" />
        <h1 className="mt-6 font-display text-heading-xl uppercase text-ink md:text-display-m">
          {upiPending
            ? "Scan To Pay."
            : barter
              ? barter.tier === "gift_first"
                ? "It's Shipping."
                : "Now Post It."
              : paid
                ? "Thank You For Your Purchase."
                : "Check WhatsApp."}
        </h1>
        <p className="mt-4 text-body text-secondary-text">
          {upiPending
            ? "Scan the QR below with any UPI app to pay. We'll confirm receipt and email you the moment it's on its way."
            : barter
              ? barter.tier === "gift_first"
                ? "Your order is on its way — no need to wait for anything. Once it arrives, wear it, post a photo, and add us as a collaborator."
                : `Post about it and share your code below. The moment ${barter.required} people check out with it, we ship — free.`
              : paid
                ? "Welcome to being an Explorer — we've emailed your invoice and sent a confirmation on WhatsApp, and your order is on its way to being packed."
                : "Your order details opened in WhatsApp — send that message through and we'll confirm payment and delivery with you directly, usually within a few hours."}
        </p>

        {upiPending && (
          <div className="mt-8 flex flex-col items-center gap-3 border border-divider p-6 text-center">
            {upiPending.qrImageUrl && (
              <Image
                src={upiPending.qrImageUrl}
                alt="Scan to pay via UPI"
                width={220}
                height={264}
                className="border border-ink/20"
              />
            )}
            {upiPending.upiId && (
              <p className="text-caption text-secondary-text">UPI ID: {upiPending.upiId}</p>
            )}
            <p className="font-display text-heading-s text-ink">₹{upiPending.amount.toLocaleString("en-IN")}</p>
            {upiPending.upiLink && (
              <a
                href={upiPending.upiLink}
                className="mt-2 inline-block border border-ink bg-ink px-6 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink"
              >
                Open In UPI App
              </a>
            )}
            <p className="mt-4 max-w-[360px] text-caption text-secondary-text">
              Already paid? No need to do anything else — we check payments and confirm within a few
              hours. You&apos;ll get an email the moment it&apos;s shipped.
            </p>
          </div>
        )}

        {barter && (
          <div className="mt-8 border border-divider p-6">
            <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Your Code</p>
            <code className="mt-3 inline-block border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s tracking-[0.1em] text-ink">
              {barter.code}
            </code>
            <p className="mt-4 text-caption text-secondary-text">
              {barter.tier === "gift_first"
                ? "We've emailed you the full step-by-step for your post — no need to wait, your order is already on its way."
                : "We've emailed you the full step-by-step, along with a link to check your progress and drop your post link once it's live."}
            </p>
            {orderId && (
              <Link
                href={`/barter/${orderId}`}
                className="mt-4 inline-block border border-ink px-6 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
              >
                View Instructions &amp; Progress
              </Link>
            )}
          </div>
        )}

        {paid && !barter && order && (
          <div className="mt-8 border border-divider p-6">
            <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
              Order Summary
            </p>
            <div className="mt-4 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-body-s">
                  <span className="text-ink">
                    {item.quantity} × Sunglasses — {item.chapter_name}
                  </span>
                  <span className="text-secondary-text">
                    ₹{(item.unit_price * item.quantity).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-divider pt-4 text-body-s">
              {order.discount_amount + order.referral_discount_amount > 0 && (
                <div className="flex items-center justify-between text-tan-gold">
                  <span>Discount</span>
                  <span>
                    −₹
                    {(order.discount_amount + order.referral_discount_amount).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              {order.shipping_charge > 0 && (
                <div className="flex items-center justify-between text-secondary-text">
                  <span>Shipping</span>
                  <span>₹{order.shipping_charge.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 font-display text-heading-s text-ink">
                <span>Total</span>
                <span>₹{order.total.toLocaleString("en-IN")}</span>
              </div>
              {order.payment_type === "cod_advance" && (
                <>
                  <div className="flex items-center justify-between text-body-s text-secondary-text">
                    <span>Paid now</span>
                    <span>₹{order.cod_advance_amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between text-body-s font-bold text-tan-gold">
                    <span>Due on delivery</span>
                    <span>₹{order.balance_due.toLocaleString("en-IN")}</span>
                  </div>
                </>
              )}
            </div>
            <p className="mt-4 text-caption text-secondary-text">Delivering to {fullAddress}</p>
            <Link
              href={`/invoice/${order.id}`}
              className="mt-4 inline-block text-caption text-ink underline underline-offset-4"
            >
              View Full Invoice
            </Link>
          </div>
        )}

        <Link
          href="/"
          className="mt-8 inline-block border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Keep Exploring
        </Link>

        {referralCode && !barter && (
          <div className="mt-12 border border-divider p-6 text-left">
            <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
              Recommend to a Fellow Explorer
            </p>
            <p className="mt-2 text-body-s text-secondary-text">
              Share your code — they get a discount on their first order, you earn Good Vibes once it
              ships.
            </p>
            <code className="mt-3 inline-block border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s tracking-[0.1em] text-ink">
              {referralCode}
            </code>

            {orderId ? (
              <form onSubmit={sendInvite} className="mt-5 space-y-3">
                <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Send it directly
                </p>
                <input
                  required
                  placeholder="Friend's name"
                  value={friend.name}
                  onChange={(e) => setFriend((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={friend.phone}
                    onChange={(e) => setFriend((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={friend.email}
                    onChange={(e) => setFriend((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="border border-ink bg-ink px-6 py-2.5 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
                {sendResult && <p className="text-caption text-ink">{sendResult}</p>}
                {sendError && <p className="text-caption text-paint-orange">{sendError}</p>}
              </form>
            ) : (
              <p className="mt-3">
                <Link href="/account" className="text-caption text-ink underline underline-offset-4">
                  Send it from your account
                </Link>
              </p>
            )}
          </div>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
