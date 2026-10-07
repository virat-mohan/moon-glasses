"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BARTER_PAGE_COPY as C } from "@/lib/pwap-email-copy";
import { BARTER_CODE_SENT_MESSAGE } from "@/lib/pwap-sales";

export function BarterSignIn({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/barter/${orderId}/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Enter a valid email address");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not send a code. try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/barter/${orderId}/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) throw new Error(C.wrongCode);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : C.wrongCode);
      setBusy(false);
    }
  }

  const input = "mt-1 w-full border border-ink/30 bg-surface px-3 py-3 font-sans text-body text-ink outline-none focus:border-ink";
  return (
    <div className="mt-5">
      <p className="text-body-s text-secondary-text">{C.signInIntro}</p>
      {step === "email" ? (
        <form onSubmit={send} className="mt-4 space-y-4">
          <label className="block font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
            Email
            <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <button disabled={busy} className="min-h-[48px] w-full bg-[var(--moon-gold)] py-3 font-sans text-body-s font-bold uppercase tracking-[0.08em] text-black disabled:opacity-60">
            {busy ? C.sending : C.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-4 space-y-4">
          <p className="text-caption text-secondary-text">{BARTER_CODE_SENT_MESSAGE}</p>
          <label className="block font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">
            {C.codeLabel}
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${input} tracking-[0.3em]`}
            />
          </label>
          <button disabled={busy || code.length !== 6} className="min-h-[48px] w-full bg-[var(--moon-gold)] py-3 font-sans text-body-s font-bold uppercase tracking-[0.08em] text-black disabled:opacity-60">
            {busy ? C.checking : C.openPage}
          </button>
          <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }} className="min-h-[44px] w-full text-caption underline">
            use a different email
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-caption text-paint-orange">{error}</p>}
    </div>
  );
}
