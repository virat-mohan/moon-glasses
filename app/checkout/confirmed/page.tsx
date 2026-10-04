"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";
import QRCode from "qrcode";
import { trackEvent } from "@/lib/client-tracking";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";
import { helpLink, shortOrderId } from "@/lib/whatsapp-help";

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
  // useSearchParams (not window.location): after a client-side redirect from
  // checkout, this page can render before the browser URL updates, so
  // window.location still pointed at /checkout and the UPI QR never showed.
  return (
    <Suspense fallback={null}>
      <OrderConfirmedContent />
    </Suspense>
  );
}

function OrderConfirmedContent() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const paid = params.get("paid") === "1";
  const barter = useMemo(() => {
    const code = params.get("code");
    const required = params.get("required");
    const tier = params.get("tier") === "gift_first" ? "gift_first" : "sell_first";
    return code ? { code, required: required ? Number(required) : 3, tier: tier as "gift_first" | "sell_first" } : null;
  }, [params]);
  const upiPending = useMemo(() => {
    if (params.get("upi") !== "1") return null;
    const qr = params.get("qr");
    return {
      amount: Number(params.get("amount") ?? 0),
      upiId: params.get("upiId") ?? "",
      qrImageUrl: qr && qr !== "null" && qr !== "undefined" ? qr : "",
      upiLink: params.get("link") ?? "",
    };
  }, [params]);
  // UPI: the QR is generated from this order's pay link (exact amount, down to
  // the paise tag the bank-SMS matcher relies on), and the page watches the
  // order until the forwarded credit SMS confirms it.
  const upiPayAmount = upiPending
    ? Number(new URLSearchParams(upiPending.upiLink.split("?")[1] ?? "").get("am") ?? upiPending.amount) || upiPending.amount
    : 0;
  const [upiQr, setUpiQr] = useState<string | null>(null);
  const [upiStatus, setUpiStatus] = useState<"waiting" | "paid" | "slow">("waiting");
  const [device, setDevice] = useState<"desktop" | "android" | "ios">("desktop");
  useEffect(() => {
    const ua = navigator.userAgent;
    setDevice(/android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "desktop");
  }, []);
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

  useEffect(() => {
    if (!upiPending) return;
    if (upiPending.upiLink) {
      QRCode.toDataURL(upiPending.upiLink, { width: 440, margin: 1 })
        .then(setUpiQr)
        .catch(() => setUpiQr(null));
    }
    if (!orderId) return;
    const started = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/summary`, { cache: "no-store" });
        const data = await res.json();
        if (data.order?.payment_status === "paid") {
          setOrder(data.order);
          setUpiStatus("paid");
          // Browser pixel Purchase only once the payment is confirmed, with
          // the order id as eventID so Meta dedupes it against the server
          // Conversions API event sent by confirmUpiOrderPayment.
          // Test orders (admin-placed) never reach the pixel.
          if (!data.order.is_test) trackEvent("Purchase", { value: Number(data.order.total) || undefined, orderId });
          return;
        }
      } catch {
        // keep polling
      }
      const elapsed = Date.now() - started;
      if (elapsed > 10 * 60 * 1000) setUpiStatus((s) => (s === "paid" ? s : "slow"));
      if (!stopped && elapsed < 60 * 60 * 1000) timer = setTimeout(poll, elapsed > 10 * 60 * 1000 ? 20000 : 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upiPaid = !!upiPending && upiStatus === "paid";

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
          {upiPaid ? "Payment Received" : upiPending ? "Awaiting Payment" : barter ? <PayWithAPostMark linked /> : paid ? "Order Confirmed" : "Order Sent"}
        </p>
        <CheckoutSteps current="confirmed" />
        <h1 className="mt-6 font-display text-heading-xl uppercase text-ink md:text-display-m">
          {upiPaid
            ? "Thank You For Your Order."
            : upiPending
            ? device === "desktop"
              ? "Scan To Pay."
              : "Pay In Your UPI App."
            : barter
              ? barter.tier === "gift_first"
                ? "It's Shipping."
                : "Now Post It."
              : paid
                ? "Thank You For Your Purchase."
                : "Check WhatsApp."}
        </h1>
        <p className="mt-4 text-body text-secondary-text">
          {upiPaid
            ? "Payment received and your order is confirmed. You'll have an email with your invoice and a WhatsApp confirmation from us, and your pair is now being packed. We'll message you again the moment it ships."
            : upiPending
            ? device === "desktop"
              ? "Scan the QR below with any UPI app on your phone. This page confirms automatically the moment your payment lands."
              : "Tap your UPI app below. The amount is filled in for you. Pay, then come back here: this page confirms automatically."
            : barter
              ? barter.tier === "gift_first"
                ? "Your order is on its way — no need to wait for anything. Once it arrives, wear it, post a photo, and add us as a collaborator."
                : `Post about it and share your code below. The moment ${barter.required} people check out with it, we ship — free.`
              : paid
                ? "Welcome to being an Explorer — we've emailed your invoice and sent a confirmation on WhatsApp, and your order is on its way to being packed."
                : "Your order details opened in WhatsApp — send that message through and we'll confirm payment and delivery with you directly, usually within a few hours."}
        </p>
        {!upiPending || upiPaid ? (
          <p className="mt-3">
            <WhatsAppHelp
              topic="my order"
              lines={[...(orderId ? [`order ${shortOrderId(orderId)}`] : []), "page: /checkout/confirmed"]}
            />
          </p>
        ) : null}

        {upiPending && !upiPaid && (
          <div className="mt-8 flex flex-col items-center gap-3 border border-divider p-6 text-center">
            <p className="font-display text-heading-s text-ink">
              ₹{upiPayAmount.toLocaleString("en-IN", { minimumFractionDigits: upiPayAmount % 1 ? 2 : 0, maximumFractionDigits: 2 })}
            </p>
            {upiPayAmount % 1 !== 0 && (
              <p className="max-w-[340px] text-caption text-secondary-text">
                Please pay this exact amount. The paise are how we match your payment to your order instantly.
              </p>
            )}

            {/* Direct QR Code display for all devices */}
            <div className="mt-2 flex flex-col items-center">
              <UpiQrImage upiQr={upiQr} fallback={upiPending.qrImageUrl} />
              <p className="mt-2 text-micro uppercase tracking-[0.08em] text-secondary-text">
                Scan with Google Pay, PhonePe, Paytm, or any UPI app
              </p>
            </div>

            {/* Actions: Download QR, Share QR, Step-by-step guide, Copy UPI ID */}
            <QrActions
              upiQr={upiQr}
              upiId={upiPending.upiId}
              amount={upiPayAmount}
              orderRef={orderId ? shortOrderId(orderId) : ""}
            />

            <div className="mt-6 w-full border-t border-divider pt-5">
              {upiStatus === "waiting" ? (
                <>
                  <p className="text-body-s font-bold text-ink">Paid? Hang tight, this takes up to a minute or two.</p>
                  <p className="mt-1.5 max-w-[380px] text-caption text-secondary-text">
                    We confirm your payment with the bank automatically. Keep this page open — it
                    updates on its own the moment your payment lands, and we&apos;ll send your
                    confirmation on WhatsApp and email.
                  </p>
                  <p className="mt-3 animate-pulse text-micro uppercase tracking-[0.1em] text-secondary-text">
                    Checking for your payment…
                  </p>
                  <p className="mt-3">
                    <WhatsAppHelp
                      label="paid but not confirmed? whatsapp us your screenshot"
                      topic="paid but not confirmed, sharing my screenshot"
                      lines={[...(orderId ? [`order ${shortOrderId(orderId)}`] : []), `paid ₹${upiPayAmount}`]}
                    />
                  </p>
                </>
              ) : (
                <>
                  <p className="text-body-s font-bold text-ink">Paid but still waiting?</p>
                  <p className="mt-1.5 max-w-[380px] text-caption text-secondary-text">
                    Sometimes the bank takes a little longer to confirm. Send us your payment screenshot
                    with the UPI reference number on WhatsApp, from the number you ordered with, and
                    we&apos;ll confirm it by hand and get your order packed.
                  </p>
                </>
              )}
              {upiStatus === "slow" && (
              <a
                href={helpLink({
                  topic: "paid but not confirmed, sharing my screenshot",
                  lines: [
                    ...(orderId ? [`order ${shortOrderId(orderId)}`] : []),
                    `paid ₹${upiPayAmount}`,
                    ...items.map((i) => `${i.chapter_name} × ${i.quantity}`),
                  ],
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block border border-ink px-6 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
              >
                Send Payment Screenshot On WhatsApp
              </a>
              )}
            </div>
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
                : "We've emailed you the full step-by-step, with a link to track sales on your code."}
            </p>
            {orderId && (
              <Link
                href={`/barter/${orderId}`}
                className="mt-5 block w-full bg-[var(--moon-gold)] px-6 py-4 text-center font-sans text-body-s font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110"
              >
                Get your post &amp; share to Instagram
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

function UpiQrImage({ upiQr, fallback }: { upiQr: string | null; fallback: string }) {
  if (upiQr) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={upiQr} alt="Scan to pay via UPI" width={220} height={220} className="border border-ink/20 bg-white p-2" />;
  }
  return fallback ? <Image src={fallback} alt="Scan to pay via UPI" width={220} height={264} className="border border-ink/20" /> : null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => {})}
      className="border border-divider px-2 py-0.5 text-micro uppercase tracking-[0.05em] text-ink"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function QrActions({
  upiQr,
  upiId,
  amount,
  orderRef,
}: {
  upiQr: string | null;
  upiId: string;
  amount: number;
  orderRef: string;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }
  }, []);

  const handleDownload = () => {
    if (!upiQr) return;
    const a = document.createElement("a");
    a.href = upiQr;
    a.download = `moon-glasses-order-${orderRef || "pay"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const handleShare = async () => {
    if (!upiQr) return;
    try {
      const res = await fetch(upiQr);
      const blob = await res.blob();
      const file = new File([blob], `moon-glasses-${orderRef || "pay"}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Moon Glasses Payment QR",
          text: `Pay ₹${amount.toFixed(2)} for Moon Glasses order #${orderRef} to ${upiId}`,
        });
        return;
      }
    } catch {
      // share cancelled or unsupported
    }
    handleDownload();
  };

  return (
    <div className="mt-2 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {upiQr && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex min-h-[44px] items-center justify-center bg-[var(--moon-gold)] px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-black transition hover:brightness-110"
          >
            {downloaded ? "QR Downloaded! ✓" : "Download QR Code"}
          </button>
        )}
        {upiQr && canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-[44px] items-center justify-center border border-ink/40 px-4 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition hover:bg-ink/5"
          >
            Share QR
          </button>
        )}
      </div>

      <div className="w-full max-w-[340px] rounded border border-divider bg-surface/50 p-3.5 text-left">
        <p className="text-micro font-bold uppercase tracking-[0.06em] text-ink">Paying on this phone?</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-micro text-secondary-text">
          <li>Tap <strong>Download QR Code</strong> above (or screenshot).</li>
          <li>Open <strong>Google Pay</strong>, <strong>PhonePe</strong>, or <strong>Paytm</strong>.</li>
          <li>Tap <strong>Scan QR (📷)</strong> &gt; <strong>Upload from Gallery / Photos</strong> to pay.</li>
        </ol>
      </div>

      {upiId && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-caption text-secondary-text">
          <span>UPI ID: {upiId}</span>
          <CopyButton value={upiId} label="Copy UPI ID" />
          <CopyButton value={amount.toFixed(2)} label="Copy amount" />
        </div>
      )}
    </div>
  );
}
