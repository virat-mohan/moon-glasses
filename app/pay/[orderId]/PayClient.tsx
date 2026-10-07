"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upiPayButtons, type UpiDevice } from "@/lib/upi-links";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";

export function PayClient({ orderRef, amount, upiId, upiLink, confirmedHref }: { orderRef: string; amount: number; upiId: string; upiLink: string; confirmedHref: string }) {
  const router = useRouter();
  const [device, setDevice] = useState<UpiDevice>("desktop");
  const [hint, setHint] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const started = useRef(false);
  const shown = amount.toLocaleString("en-IN", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 });

  useEffect(() => {
    const ua = navigator.userAgent;
    const d: UpiDevice = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "desktop";
    setDevice(d);
    if (d === "desktop" || started.current) return;
    started.current = true;
    // Open the UPI app with the amount filled in. If WhatsApp's in-app browser blocks it, the buttons below still work.
    const t1 = setTimeout(() => { window.location.href = upiLink; }, 600);
    const t2 = setTimeout(() => setHint(true), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [upiLink]);

  // Once a payment app is opened, this page moves to the confirmation screen, which watches the order until the bank confirms.
  const goConfirm = () => setTimeout(() => router.push(confirmedHref), 1500);
  const copy = (label: string, v: string) => navigator.clipboard?.writeText(v).then(() => setCopied(label)).catch(() => {});

  const buttons = upiPayButtons(upiLink, device);
  return (
    <main className="mx-auto w-full max-w-[480px] px-6 pb-24 pt-32 text-center">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Order #{orderRef}</p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Pay In One Tap.</h1>
      <p className="mt-6 font-display text-display-m text-ink">₹{shown}</p>
      <p className="mt-2 text-body-s text-secondary-text">
        {amount % 1 ? "Pay this exact amount. The paise are how we match your payment to your order. " : ""}Shipping is free.
      </p>

      {device === "desktop" ? (
        <p className="mt-6 text-body-s text-secondary-text">Open this page on your phone to pay with your UPI app, or pay to the UPI ID below.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3">
          {buttons.map((b, i) => (
            <a key={b.name} href={b.href} onClick={goConfirm}
              className={`flex min-h-[56px] items-center justify-center px-4 font-sans text-body-s font-bold uppercase tracking-[0.05em] ${i === 0 ? "bg-[var(--moon-gold)] text-black" : "border border-ink/40 text-ink"}`}>
              {b.name}
            </a>
          ))}
        </div>
      )}

      {hint && (
        <p className="mt-4 text-caption text-secondary-text">
          Nothing opened? Tap the menu (⋮ or the share icon) and choose &quot;Open in browser&quot;, then tap again. Or pay to the UPI ID below.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-caption text-secondary-text">
        <span className="break-all font-mono font-medium text-ink">UPI ID: {upiId}</span>
        <button type="button" onClick={() => copy("id", upiId)} className="min-h-[44px] border border-divider px-3 text-micro uppercase tracking-[0.05em] text-ink">{copied === "id" ? "Copied" : "Copy UPI ID"}</button>
        <button type="button" onClick={() => copy("amt", amount.toFixed(2))} className="min-h-[44px] border border-divider px-3 text-micro uppercase tracking-[0.05em] text-ink">{copied === "amt" ? "Copied" : "Copy amount"}</button>
      </div>

      <p className="mt-4 text-micro text-secondary-text">
        If your UPI app blocks auto-fill due to bank security policy: Copy the UPI ID &amp; exact amount above, open your UPI app and pay directly.
      </p>

      <a href={confirmedHref} className="mt-8 inline-flex min-h-[44px] items-center text-caption text-secondary-text underline">Already paid? Check your payment</a>
      <p className="mt-6"><WhatsAppHelp topic="paying for my order" lines={[`order #${orderRef}`, "page: /pay"]} /></p>
    </main>
  );
}
