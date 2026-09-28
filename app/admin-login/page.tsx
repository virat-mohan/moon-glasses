"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "setup" | "invite" | "unconfigured" | null;

const INPUT =
  "w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink";

function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  const inviteCode = params.get("invite");
  const inviteEmail = params.get("email");
  const isInvite = !!(inviteCode && inviteEmail);
  const [mode, setMode] = useState<Mode>(isInvite ? "invite" : null);

  useEffect(() => {
    if (isInvite) return;
    fetch("/api/admin-auth")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => setMode("unconfigured"));
  }, [isInvite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if ((mode === "setup" || mode === "invite") && password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "setup"
            ? { action: "setup", setupCode, password }
            : mode === "invite"
              ? { action: "accept_invite", email: inviteEmail, code: inviteCode, password }
              : { action: "login", password }
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Login failed");
      const next = params.get("next");
      router.push(next && next.startsWith("/admin") ? next : "/admin/orders");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="font-display text-heading-l uppercase text-ink">Admin</h1>
      {mode === null && <p className="mt-6 text-body-s text-secondary-text">Loading…</p>}
      {mode === "unconfigured" && (
        <p className="mt-6 text-body-s text-secondary-text">Admin access hasn&apos;t been set up yet.</p>
      )}
      {(mode === "login" || mode === "setup" || mode === "invite") && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "invite" && (
            <p className="text-caption text-secondary-text">
              You&apos;ve been given admin access as {inviteEmail}. Choose your own password; you&apos;ll use it to sign in from now on.
            </p>
          )}
          {mode === "setup" && (
            <>
              <p className="text-caption text-secondary-text">
                First-time setup: enter the one-time setup code, then choose your admin password.
              </p>
              <input autoFocus placeholder="Setup code" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} className={INPUT} />
            </>
          )}
          <input
            type="password"
            autoFocus={mode === "login"}
            placeholder={mode === "login" ? "Password" : "New password (10+ characters)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          {(mode === "setup" || mode === "invite") && (
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
          )}
          {error && <p className="text-caption text-paint-orange">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password || (mode === "setup" && !setupCode)}
            className="w-full border border-ink px-5 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {loading ? "Checking..." : mode === "login" ? "Enter" : "Set Password & Enter"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
