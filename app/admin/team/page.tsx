"use client";

import { useEffect, useState } from "react";

type Team = { members: { email: string; addedAt: string }[]; invites: { email: string; expiresAt: string }[] };

const INPUT =
  "w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink sm:w-80";
const BUTTON =
  "border border-ink px-4 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50";

export default function TeamAccessPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/team");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not load team");
      return;
    }
    setTeam(data);
  }

  useEffect(() => {
    fetch("/api/admin/team")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok) setTeam(data);
        else setError(data?.error ?? "Could not load team");
      })
      .catch(() => setError("Could not load team"));
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not create invite");
      return;
    }
    setLink(data.link);
    setEmail("");
    load();
  }

  async function remove(address: string) {
    if (!confirm(`Remove ${address}? Everyone signed in to the admin will need to sign in again.`)) return;
    await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address }),
    });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="font-display text-heading-l uppercase text-ink">Team Access</h1>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Give someone their own admin login instead of sharing yours. They get a one-time link, choose their own
        password, and you can remove them any time. Only you can invite or remove people or change the owner password.
      </p>

      <form onSubmit={invite} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input type="email" required placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        <button type="submit" disabled={busy} className={BUTTON}>
          {busy ? "Creating…" : "Create invite link"}
        </button>
      </form>

      {link && (
        <div className="mt-4 border border-divider p-4">
          <p className="text-caption text-secondary-text">
            Send this link to them yourself (WhatsApp or email). It works once and expires in 7 days.
          </p>
          <p className="mt-2 break-all font-mono text-caption text-ink">{link}</p>
          <button type="button" onClick={() => navigator.clipboard.writeText(link)} className={`${BUTTON} mt-3`}>
            Copy link
          </button>
        </div>
      )}
      {error && <p className="mt-4 text-caption text-paint-orange">{error}</p>}

      {team && (
        <div className="mt-10 space-y-6">
          <section>
            <p className="text-caption uppercase tracking-[0.05em] text-secondary-text">Team members</p>
            {team.members.length === 0 && <p className="mt-2 text-body-s text-secondary-text">No one yet.</p>}
            <ul className="mt-2 divide-y divide-divider border-y border-divider">
              {team.members.map((m) => (
                <li key={m.email} className="flex items-center justify-between py-3 text-body-s text-ink">
                  <span>{m.email}</span>
                  <button type="button" onClick={() => remove(m.email)} className="text-caption text-paint-orange underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {team.invites.length > 0 && (
            <section>
              <p className="text-caption uppercase tracking-[0.05em] text-secondary-text">Pending invites</p>
              <ul className="mt-2 divide-y divide-divider border-y border-divider">
                {team.invites.map((i) => (
                  <li key={i.email} className="flex items-center justify-between py-3 text-body-s text-secondary-text">
                    <span>{i.email}</span>
                    <button type="button" onClick={() => remove(i.email)} className="text-caption underline">
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
