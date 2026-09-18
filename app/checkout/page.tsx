"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useDiscountRule } from "@/lib/useDiscountRule";
import { calculateDiscount } from "@/lib/discounts";
import { trackEvent, getSessionKey, getAttribution, getReferralCode } from "@/lib/client-tracking";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";

const WHATSAPP_NUMBER = "918800339125";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Account = {
  customer: { id: string; phone: string | null; name: string | null; email: string | null; newsletter_subscribed: boolean } | null;
  addresses: {
    id: string;
    recipient_name: string;
    phone: string;
    address_line: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    is_default: boolean;
  }[];
  loyalty: { balance: number; maxRedeemableRupees: number; threshold: number } | null;
};

type IdentityStep = "checking" | "identify" | "otp" | "guest" | "verified";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const discountRule = useDiscountRule();
  const discount = calculateDiscount(items, discountRule);
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [razorpay, setRazorpay] = useState<{ enabled: boolean; keyId: string | null; codAdvanceRupees: number }>({
    enabled: false,
    keyId: null,
    codAdvanceRupees: 99,
  });
  // razorpay.enabled defaults to false until /api/checkout/config resolves —
  // without this separate flag, a customer submitting the form before that
  // fetch completes (a real risk: it's an async call fired on mount) would
  // silently fall through to the WhatsApp-manual-order path instead of
  // actually being charged via Razorpay, even though Razorpay is properly
  // configured. The submit button stays disabled until this is true.
  const [configLoaded, setConfigLoaded] = useState(false);
  // Only seeded from a real `?ref=` link capture (see captureReferral in
  // lib/client-tracking.ts) — typing a code here is deliberately local
  // component state only, not persisted, so a code tried once doesn't keep
  // silently re-applying itself on unrelated future checkouts.
  const [referralCodeInput, setReferralCodeInput] = useState(() => getReferralCode() ?? "");
  const [referralPreview, setReferralPreview] = useState<{ checked: string; valid: boolean; discountRupees: number } | null>(null);
  const [referralChecking, setReferralChecking] = useState(false);
  function updateReferralCode(value: string) {
    setReferralCodeInput(value);
  }
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [couponPreview, setCouponPreview] = useState<{ checked: string; valid: boolean; discountRupees: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [redeemMiles, setRedeemMiles] = useState(false);
  // Prepaid ships free nationwide; COD charges the real Shiprocket rate
  // (collected by the courier alongside the balance due) plus a small
  // upfront advance to filter out fake/non-serious COD orders.
  const [paymentType, setPaymentType] = useState<"prepaid" | "cod_advance">("prepaid");
  const [shippingCharge, setShippingCharge] = useState<number | null>(null);
  const [shippingUnavailable, setShippingUnavailable] = useState(false);
  // Distinct from shippingUnavailable: this specifically means Shiprocket
  // checked and confirmed it can't deliver to this pincode — a real RTO
  // risk, so it blocks payment. A plain "unavailable" (our config, or a
  // transient API hiccup) never blocks — see getShippingRate's doc comment.
  const [shippingBlocking, setShippingBlocking] = useState(false);

  // Identity-first flow: verify who's checking out before showing the full
  // order form, so a returning customer's address and Miles are pulled in
  // automatically instead of retyping everything. "Continue as guest" skips
  // straight to the manual form for anyone who'd rather not verify.
  const [identityStep, setIdentityStep] = useState<IdentityStep>("checking");
  // Temporarily email-based rather than phone — WhatsApp OTP delivery isn't
  // reliable yet (see lib/msg91.ts), switch this back to phone once that's
  // confirmed working end to end.
  const [identifyEmail, setIdentifyEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const loyaltyDiscount = redeemMiles ? account?.loyalty?.maxRedeemableRupees ?? 0 : 0;
  const normalizedReferralCode = referralCodeInput.trim().toUpperCase();
  const referralDiscount =
    referralPreview?.checked === normalizedReferralCode && referralPreview.valid
      ? Math.min(referralPreview.discountRupees, subtotal)
      : 0;
  const normalizedCouponCode = couponCodeInput.trim().toUpperCase();
  const couponDiscount =
    couponPreview?.checked === normalizedCouponCode && couponPreview.valid
      ? Math.min(couponPreview.discountRupees, subtotal)
      : 0;
  // Free-shipping-on-prepaid is what the customer is actually charged;
  // shippingCharge itself always holds the real Shiprocket rate (needed to
  // confirm the pincode is even deliverable, and shown as-is for COD).
  const displayShippingCharge = paymentType === "prepaid" ? 0 : (shippingCharge ?? 0);
  const total =
    Math.max(0, subtotal - discount - loyaltyDiscount - referralDiscount - couponDiscount) +
    displayShippingCharge;
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Live referral-code validation — mirrors resolveReferralDiscount's rules
  // (self-referral, one-time-per-customer) so the total shown before payment
  // matches what create-order/verify will actually charge, instead of the
  // shopper only finding out the code didn't apply after paying.
  useEffect(() => {
    const code = normalizedReferralCode;
    const timeout = setTimeout(() => {
      if (!code) {
        setReferralPreview(null);
        return;
      }
      setReferralChecking(true);
      fetch("/api/checkout/referral-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code, phone: form.phone }),
      })
        .then((res) => res.json())
        .then((data) => setReferralPreview({ checked: code, valid: !!data.valid, discountRupees: data.discountRupees ?? 0 }))
        .catch(() => setReferralPreview({ checked: code, valid: false, discountRupees: 0 }))
        .finally(() => setReferralChecking(false));
    }, 500);
    return () => clearTimeout(timeout);
  }, [normalizedReferralCode, form.phone]);

  // Explicit "Apply" action rather than live-as-you-type (unlike the
  // referral code above) — checked once, on click, not on every keystroke.
  function applyCoupon() {
    const code = normalizedCouponCode;
    if (!code) {
      setCouponPreview(null);
      return;
    }
    setCouponChecking(true);
    fetch("/api/checkout/coupon-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponCode: code, subtotal }),
    })
      .then((res) => res.json())
      .then((data) => setCouponPreview({ checked: code, valid: !!data.valid, discountRupees: data.discountRupees ?? 0 }))
      .catch(() => setCouponPreview({ checked: code, valid: false, discountRupees: 0 }))
      .finally(() => setCouponChecking(false));
  }

  // Live pass-through shipping quote from Shiprocket, by pincode — a
  // display-only preview; the actual charge is recomputed server-side from
  // the same pincode when the order is placed, so this can never be spoofed
  // into a lower number by the client.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!/^\d{6}$/.test(form.pincode)) {
        setShippingCharge(null);
        setShippingUnavailable(false);
        setShippingBlocking(false);
        return;
      }
      fetch("/api/checkout/shipping-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: form.pincode, unitCount }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.available) {
            setShippingCharge(data.rate);
            setShippingUnavailable(false);
            setShippingBlocking(false);
          } else {
            setShippingCharge(null);
            setShippingUnavailable(true);
            setShippingBlocking(!!data.blocking);
          }
        })
        .catch(() => {
          setShippingCharge(null);
          setShippingUnavailable(false);
          setShippingBlocking(false);
        });
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.pincode, unitCount]);

  // Auto-fills city/state from the pincode so the shopper only has to type
  // one thing instead of three — India Post's public lookup, no API key
  // needed. Never overwrites a city/state the shopper already typed
  // themselves (e.g. after switching back from a different pincode).
  useEffect(() => {
    if (!/^\d{6}$/.test(form.pincode)) return;
    let cancelled = false;
    fetch(`https://api.postalpincode.in/pincode/${form.pincode}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const office = data?.[0]?.PostOffice?.[0];
        if (!office) return;
        setForm((prev) => ({
          ...prev,
          city: prev.city || office.District,
          state: prev.state || office.State,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.pincode]);

  useEffect(() => {
    fetch("/api/checkout/config")
      .then((res) => res.json())
      .then((data) =>
        setRazorpay({
          enabled: !!data.razorpayEnabled,
          keyId: data.razorpayKeyId,
          codAdvanceRupees: data.codAdvanceRupees ?? 99,
        })
      )
      .catch(() => setRazorpay({ enabled: false, keyId: null, codAdvanceRupees: 99 }))
      .finally(() => setConfigLoaded(true));
  }, []);

  function applyAccount(data: Account) {
    setAccount(data);
    if (data.customer) {
      const defaultAddress = data.addresses.find((a) => a.is_default) ?? data.addresses[0];
      setForm((f) => ({
        name: f.name || data.customer?.name || defaultAddress?.recipient_name || "",
        phone: f.phone || data.customer?.phone || defaultAddress?.phone || "",
        email: f.email || data.customer?.email || "",
        address: f.address || defaultAddress?.address_line || "",
        city: f.city || defaultAddress?.city || "",
        state: f.state || defaultAddress?.state || "",
        pincode: f.pincode || defaultAddress?.pincode || "",
      }));
      setIdentityStep("verified");
    } else {
      setIdentityStep("identify");
    }
  }

  useEffect(() => {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then(applyAccount)
      .catch(() => setIdentityStep("identify"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (items.length > 0) trackEvent("InitiateCheckout", { value: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced cart-session capture — this is what makes an abandoned cart
  // retargetable at all: the moment a shopper has typed a phone/email, we
  // know who they are even if they never finish paying.
  useEffect(() => {
    if (!form.name && !form.phone && !form.email) return;
    const timeout = setTimeout(() => {
      fetch("/api/cart-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey: getSessionKey(),
          name: form.name,
          phone: form.phone,
          email: form.email,
          items,
          subtotal: total,
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timeout);
  }, [form, items, total]);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    setRedeemMiles(false);
    setIdentityStep("identify");
  }

  async function sendIdentifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!identifyEmail.trim()) {
      setIdentityError("Enter an email address.");
      return;
    }
    setIdentityLoading(true);
    setIdentityError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifyEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setIdentityStep("otp");
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setIdentityLoading(false);
    }
  }

  async function verifyIdentifyCode(e: React.FormEvent) {
    e.preventDefault();
    setIdentityLoading(true);
    setIdentityError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifyEmail.trim(),
          code: otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not verify code");
      const me = await fetch("/api/account/me").then((r) => r.json());
      applyAccount(me);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      setIdentityLoading(false);
    }
  }

  async function handleRazorpayPayment() {
    setPayError(null);
    setPaying(true);
    try {
      const cartItems = items.map((i) => ({ slug: i.slug, quantity: i.quantity }));
      // Built once, sent to both create-order (as a recoverable snapshot —
      // see pending_orders) and verify (the actual source of truth) so the
      // two can never drift apart.
      const orderPayload = {
        customer: form,
        items: cartItems,
        isGift,
        giftNote: isGift ? giftNote : null,
        sessionKey: getSessionKey(),
        redeemMilesRupees: loyaltyDiscount,
        newsletterOptIn,
        paymentType,
        attributedAdBriefId: getAttribution(),
        referralCode: referralCodeInput.trim().toUpperCase() || null,
        couponCode: couponCodeInput.trim().toUpperCase() || null,
      };
      const createRes = await fetch("/api/checkout/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems,
          redeemMilesRupees: loyaltyDiscount,
          pincode: form.pincode,
          paymentType,
          phone: form.phone,
          referralCode: referralCodeInput.trim().toUpperCase() || null,
          couponCode: couponCodeInput.trim().toUpperCase() || null,
          order: orderPayload,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Could not start payment");

      const rzp = new window.Razorpay({
        key: createData.keyId,
        order_id: createData.razorpayOrderId,
        amount: Math.round(createData.chargeAmount * 100),
        currency: "INR",
        name: "Moonglasses",
        description: "Order payment",
        prefill: { name: form.name, email: form.email, contact: form.phone },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/checkout/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                order: orderPayload,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            trackEvent("Purchase", { value: createData.total });
            clear();
            router.push(`/checkout/confirmed?order=${verifyData.orderId}&paid=1`);
          } catch (err) {
            setPayError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.open();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not start payment");
      setPaying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!configLoaded) return; // guarded — see the disabled submit button below

    if (razorpay.enabled) {
      await handleRazorpayPayment();
      return;
    }

    let createdOrderId: string | null = null;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({
            slug: i.slug,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          subtotal,
          discountAmount: discount,
          isGift,
          giftNote: isGift ? giftNote : null,
          sessionKey: getSessionKey(),
          redeemMilesRupees: loyaltyDiscount,
          newsletterOptIn,
          attributedAdBriefId: getAttribution(),
          referralCode: referralCodeInput.trim().toUpperCase() || null,
          couponCode: couponCodeInput.trim().toUpperCase() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      createdOrderId = data?.orderId ?? null;
      trackEvent("Purchase", { value: total });
    } catch (err) {
      // Best-effort logging — WhatsApp remains the real order channel either way.
      console.error("Order logging failed", err);
    }

    const lines = [
      "New order from moon-glasses.store",
      "",
      ...items.map((i) => `${i.quantity} x ${i.name} — ₹${(i.price * i.quantity).toLocaleString("en-IN")}`),
      "",
      `Subtotal: ₹${subtotal.toLocaleString("en-IN")}`,
      ...(discount > 0 ? [`Discount: −₹${discount.toLocaleString("en-IN")}`] : []),
      ...(loyaltyDiscount > 0 ? [`Moonglasses Miles redeemed: −₹${loyaltyDiscount.toLocaleString("en-IN")}`] : []),
      ...(displayShippingCharge ? [`Shipping: ₹${displayShippingCharge.toLocaleString("en-IN")}`] : []),
      `Total: ₹${total.toLocaleString("en-IN")}`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      ...(form.email ? [`Email: ${form.email}`] : []),
      `Address: ${form.address}, ${form.city}, ${form.state} ${form.pincode}`,
      ...(isGift ? ["", "This is a gift.", `Gift note: ${giftNote || "(none)"}`] : []),
    ];

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
    clear();
    router.push(createdOrderId ? `/checkout/confirmed?order=${createdOrderId}` : "/checkout/confirmed");
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 text-center md:px-12 md:pt-40">
        <p className="font-display text-heading-l uppercase text-ink">Your Cart Is Empty.</p>
        <Link
          href="/"
          className="mt-6 inline-block font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:text-[var(--moon-gold)]"
        >
          Browse The Series
        </Link>
      </main>
    );
  }

  const orderSummary = (
    <div className="mt-4 space-y-2 border-y border-divider py-6">
      {items.map((item) => (
        <div key={item.slug} className="flex items-center justify-between text-body-s">
          <span className="text-ink">
            {item.quantity} × {item.name}
          </span>
          <span className="text-secondary-text">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
        </div>
      ))}
      {discount > 0 && discountRule && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">{discountRule.name}</span>
          <span className="text-tan-gold">−₹{discount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {loyaltyDiscount > 0 && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">Moonglasses Miles Redeemed</span>
          <span className="text-tan-gold">−₹{loyaltyDiscount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {referralDiscount > 0 && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">Referral Code ({normalizedReferralCode})</span>
          <span className="text-tan-gold">−₹{referralDiscount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-tan-gold">Coupon ({normalizedCouponCode})</span>
          <span className="text-tan-gold">−₹{couponDiscount.toLocaleString("en-IN")}</span>
        </div>
      )}
      {shippingCharge != null && (
        <div className="flex items-center justify-between text-body-s">
          <span className="text-secondary-text">Shipping</span>
          {paymentType === "prepaid" ? (
            <span className="text-tan-gold">FREE</span>
          ) : (
            <span className="text-secondary-text">₹{shippingCharge.toLocaleString("en-IN")}</span>
          )}
        </div>
      )}
      {shippingBlocking && (
        <p className="text-caption text-paint-orange">
          We can&apos;t currently deliver to that pincode — please double-check it or use a different
          address before continuing.
        </p>
      )}
      {shippingUnavailable && !shippingBlocking && (
        <p className="text-caption text-paint-orange">
          We couldn&apos;t find delivery rates for that pincode — double-check it, or we&apos;ll confirm
          shipping with you directly.
        </p>
      )}
      <div className="flex items-center justify-between pt-3 font-display text-heading-s text-ink">
        <span>Total</span>
        <span>₹{total.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );

  return (
    <>
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Checkout</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Almost Done.
        </h1>
        <CheckoutSteps current="checkout" />

        {(identityStep === "identify" || identityStep === "otp") && (
          <>
            {orderSummary}

            {identityStep === "identify" ? (
              <div className="mt-8 space-y-4">
                <button
                  type="button"
                  onClick={() => setIdentityStep("guest")}
                  className="w-full py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:text-[var(--moon-gold)]"
                >
                  Continue As Guest
                </button>

                <div className="flex items-center gap-3 text-caption text-secondary-text">
                  <span className="h-px flex-1 bg-divider" />
                  or
                  <span className="h-px flex-1 bg-divider" />
                </div>

                <form onSubmit={sendIdentifyCode} className="space-y-4">
                  <div>
                    <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={identifyEmail}
                      onChange={(e) => setIdentifyEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                    />
                    <p className="mt-1.5 text-caption text-secondary-text">
                      Use this to redeem your Moonglasses Miles and have your address filled in automatically.
                    </p>
                  </div>
                  {identityError && <p className="text-body-s text-paint-orange">{identityError}</p>}
                  <button
                    type="submit"
                    disabled={identityLoading}
                    className="w-full py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:text-[var(--moon-gold)] disabled:opacity-60"
                  >
                    {identityLoading ? "Sending..." : "Continue"}
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={verifyIdentifyCode} className="mt-8 space-y-4">
                <p className="text-body-s text-secondary-text">
                  Enter the 6-digit code sent to {identifyEmail.trim()}.
                </p>
                <input
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-heading-s tracking-[0.3em] text-ink outline-none focus:border-ink"
                />
                {identityError && <p className="text-body-s text-paint-orange">{identityError}</p>}
                <button
                  type="submit"
                  disabled={identityLoading}
                  className="w-full py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:text-[var(--moon-gold)] disabled:opacity-60"
                >
                  {identityLoading ? "Verifying..." : "Verify & Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityStep("identify")}
                  className="w-full text-center text-caption text-secondary-text underline"
                >
                  Start Over
                </button>
              </form>
            )}
          </>
        )}

        {(identityStep === "verified" || identityStep === "guest") && (
          <>
            <p className="mt-4 max-w-md text-body-s text-secondary-text">
              {razorpay.enabled
                ? "Pay securely below and we'll email your invoice and confirm right after."
                : "We don't run this through a payment gateway yet — placing an order sends your details and cart straight to us on WhatsApp, and we'll confirm payment and delivery with you directly."}
            </p>

            <div className="mt-6 flex items-center justify-between border-t border-divider pt-4 text-body-s">
              {identityStep === "verified" && account?.customer ? (
                <>
                  <span className="text-secondary-text">
                    Logged in as{" "}
                    <span className="text-ink">{account.customer.phone || account.customer.email}</span>
                    {account.loyalty && account.loyalty.balance > 0 && (
                      <> · {account.loyalty.balance.toLocaleString("en-IN")} Moonglasses Miles</>
                    )}
                  </span>
                  <button type="button" onClick={logOut} className="text-caption text-secondary-text underline">
                    Log Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIdentityStep("identify")}
                  className="text-caption text-ink underline"
                >
                  Have an account? Verify for faster checkout &amp; Miles
                </button>
              )}
            </div>

            {razorpay.enabled && (
              <div className="mt-6 border-2 border-ink bg-tan-gold/20 p-4">
                <p className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">
                  Pay in full — ship free, anywhere in India.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setPaymentType("prepaid")}
                    className={`relative flex-1 border px-4 py-2.5 text-left font-sans text-body-s transition-colors duration-200 ${
                      paymentType === "prepaid" ? "border-ink bg-ink text-cream" : "border-ink/30 text-ink"
                    }`}
                  >
                    <span className="absolute -top-2.5 right-2 bg-tan-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em] text-ink">
                      Free Shipping
                    </span>
                    <span className="block font-bold uppercase tracking-[0.03em]">Prepaid</span>
                    <span className="block text-caption opacity-80">Free shipping, pay ₹{total.toLocaleString("en-IN")} now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("cod_advance")}
                    className={`flex-1 border px-4 py-2.5 text-left font-sans text-body-s transition-colors duration-200 ${
                      paymentType === "cod_advance" ? "border-ink bg-ink text-cream" : "border-ink/30 text-ink"
                    }`}
                  >
                    <span className="block font-bold uppercase tracking-[0.03em]">Cash On Delivery</span>
                    <span className="block text-caption opacity-80">
                      Pay ₹{razorpay.codAdvanceRupees.toLocaleString("en-IN")} now, rest on delivery
                    </span>
                  </button>
                </div>
              </div>
            )}

            {orderSummary}

            {account?.loyalty && account.loyalty.maxRedeemableRupees > 0 && (
              <label className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={redeemMiles}
                  onChange={(e) => setRedeemMiles(e.target.checked)}
                  className="h-4 w-4 accent-ink"
                />
                <span className="font-sans text-body-s text-ink">
                  Redeem Moonglasses Miles for ₹{account.loyalty.maxRedeemableRupees.toLocaleString("en-IN")} off
                </span>
              </label>
            )}

            <div className="mt-4">
              <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                Referral Code (Optional)
              </label>
              <input
                value={referralCodeInput}
                onChange={(e) => updateReferralCode(e.target.value)}
                placeholder="Got a code from a friend? Enter it here"
                className="mt-1.5 w-full max-w-[280px] border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s uppercase text-ink outline-none placeholder:normal-case placeholder:text-secondary-text focus:border-ink"
              />
              {normalizedReferralCode && (
                <p className="mt-2 text-caption">
                  {referralChecking ? (
                    <span className="text-secondary-text">Checking code...</span>
                  ) : referralPreview?.checked === normalizedReferralCode && referralPreview.valid ? (
                    <span className="text-tan-gold">
                      Code applied — ₹{referralDiscount.toLocaleString("en-IN")} off
                    </span>
                  ) : referralPreview?.checked === normalizedReferralCode ? (
                    <span className="text-paint-orange">That code isn&apos;t valid for this order.</span>
                  ) : null}
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                Coupon Code (Optional)
              </label>
              <div className="mt-1.5 flex max-w-[280px] items-center gap-1.5">
                <input
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value)}
                  placeholder="Have a code? Enter it here"
                  className="min-w-0 flex-1 border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s uppercase text-ink outline-none placeholder:normal-case placeholder:text-secondary-text focus:border-ink"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={!normalizedCouponCode || couponChecking}
                  className="shrink-0 border border-ink/30 px-3 py-2 font-sans text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                >
                  {couponChecking ? "..." : "Apply"}
                </button>
              </div>
              {normalizedCouponCode && couponPreview?.checked === normalizedCouponCode && (
                <p className="mt-2 text-caption">
                  {couponPreview.valid ? (
                    <span className="text-tan-gold">Code applied — ₹{couponDiscount.toLocaleString("en-IN")} off</span>
                  ) : (
                    <span className="text-paint-orange">That code isn&apos;t valid for this order.</span>
                  )}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-4">
              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Full Name
                </label>
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={update("name")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Phone
                </label>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={update("email")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Pincode
                </label>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={form.pincode}
                  onChange={update("pincode")}
                  className="mt-1.5 w-full max-w-[200px] border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
                <p className="mt-1.5 text-caption text-secondary-text">We&apos;ll fill in your city and state automatically.</p>
              </div>

              <div>
                <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                  Delivery Address
                </label>
                <textarea
                  required
                  rows={3}
                  autoComplete="address-line1"
                  placeholder="House/flat, street, area"
                  value={form.address}
                  onChange={update("address")}
                  className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    City
                  </label>
                  <input
                    required
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={update("city")}
                    className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                    State
                  </label>
                  <input
                    required
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={update("state")}
                    className="mt-1.5 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div className="border-t border-divider pt-6">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isGift}
                    onChange={(e) => setIsGift(e.target.checked)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="font-sans text-body-s uppercase tracking-[0.05em] text-ink">
                    This is a gift
                  </span>
                </label>

                {isGift && (
                  <textarea
                    rows={3}
                    placeholder="Add a personal note to include with the order..."
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    className="mt-4 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
                  />
                )}

                <label className="mt-4 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={newsletterOptIn}
                    onChange={(e) => setNewsletterOptIn(e.target.checked)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="font-sans text-body-s text-ink">
                    Send me new drops, restocks and offers
                  </span>
                </label>

              </div>

              {payError && <p className="text-body-s text-paint-orange">{payError}</p>}

              <button
                type="submit"
                disabled={paying || shippingBlocking || !configLoaded}
                className="w-full py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:text-[var(--moon-gold)] disabled:opacity-60"
              >
                {!configLoaded
                  ? "Loading..."
                  : shippingBlocking
                    ? "Undeliverable Pincode"
                    : razorpay.enabled
                      ? paying
                        ? "Processing..."
                        : paymentType === "cod_advance"
                          ? `Pay ₹${Math.min(razorpay.codAdvanceRupees, total).toLocaleString("en-IN")} Now`
                          : `Pay ₹${total.toLocaleString("en-IN")}`
                      : "Place Order via WhatsApp"}
              </button>
            </form>
          </>
        )}
      </main>

      {razorpay.enabled && <Script src="https://checkout.razorpay.com/v1/checkout.js" />}

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
