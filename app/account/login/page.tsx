"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/account";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not verify code");
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Account</p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
        Log In.
      </h1>
      <p className="mt-4 text-body-s text-secondary-text">
        No password — enter your email, and we&apos;ll send you a code.
      </p>

      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-10 space-y-6">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
            />
          </div>
          {error && <p className="text-body-s text-paint-orange">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-10 space-y-6">
          <p className="text-body-s text-secondary-text">
            Enter the 6-digit code sent to {email.trim()}.
          </p>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Code
            </label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-heading-s tracking-[0.3em] text-ink outline-none focus:border-ink"
            />
          </div>
          {error && <p className="text-body-s text-paint-orange">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify & Log In"}
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-center text-caption text-secondary-text underline"
          >
            Start over
          </button>
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
