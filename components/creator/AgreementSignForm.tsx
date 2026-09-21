"use client";

import { useState } from "react";

export function AgreementSignForm({ creatorId }: { creatorId: string }) {
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "signing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signedName.trim()) {
      setError("Type your full name to sign");
      return;
    }
    if (!agreed) {
      setError("Confirm you've read and agree to the terms");
      return;
    }

    setStatus("signing");
    try {
      const res = await fetch(`/api/creators/${creatorId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedName: signedName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign the agreement");
      setCouponCode(data.couponCode ?? null);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign the agreement");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div>
        <p className="text-body-s text-ink">You&apos;re all set — the agreement is signed.</p>
        {couponCode && (
          <p className="mt-2 text-caption text-secondary-text">
            Your creator code: <strong className="text-ink">{couponCode}</strong>
          </p>
        )}
        <p className="mt-4 text-caption text-secondary-text">We&apos;ll ship your product shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSign} className="flex flex-col gap-4">
      <label className="text-caption uppercase tracking-[0.1em] text-secondary-text">
        Type your full legal name to sign
        <input
          type="text"
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          placeholder="Full name"
          className="mt-2 block w-full border border-divider bg-transparent px-4 py-3 font-sans text-body-s text-ink placeholder:text-secondary-text focus:border-ink focus:outline-none"
        />
      </label>

      <label className="flex items-start gap-2 text-caption text-secondary-text">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        I have read and agree to the terms above.
      </label>

      {error && <p className="text-caption text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={status === "signing"}
        className="mt-2 border border-ink bg-ink px-6 py-3 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream disabled:opacity-60"
      >
        {status === "signing" ? "Signing…" : "Sign Agreement"}
      </button>
    </form>
  );
}
