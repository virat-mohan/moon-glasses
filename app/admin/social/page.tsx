"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = {
  appConfigured: boolean;
  appId: string | null;
  redirectUri: string;
  connection: { username: string; daysLeft: number; connectedAt: string } | null;
};

type Post = {
  id: string;
  caption: string | null;
  permalink: string | null;
  mediaType: string;
  timestamp: string;
  reach: number | null;
  interactions: number | null;
};

const INPUT = "w-full border border-ink/30 bg-surface px-3 py-2 text-body-s text-ink outline-none focus:border-ink";
const BUTTON =
  "border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50";

function SocialPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("instagram_error"));
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/instagram")
      .then((r) => r.json())
      .then((d: Status) => {
        setStatus(d);
        if (d.connection) {
          fetch("/api/admin/instagram/recent")
            .then((r) => r.json())
            .then((p) => (p.error ? setPostsError(p.error) : setPosts(p.posts)))
            .catch(() => setPostsError("Could not load posts"));
        }
      })
      .catch(() => setError("Could not load Instagram status"));
  }, []);

  useEffect(load, [load]);

  const justConnected = params.get("instagram")?.replace(/^connected:/, "");

  async function saveApp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, appSecret }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setAppSecret("");
      setMessage("Saved — now click Connect Instagram.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Instagram? Scheduled posts won't publish until you reconnect.")) return;
    await fetch("/api/admin/instagram", { method: "DELETE" });
    setPosts(null);
    load();
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="font-display text-heading-l uppercase text-ink">Social</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Connect your accounts once, then post and schedule everything from here.
      </p>

      {justConnected && <p className="mt-4 text-body-s text-tan-gold">Connected @{justConnected} ✓</p>}
      {error && <p className="mt-4 text-body-s text-paint-orange">{error}</p>}
      {message && <p className="mt-4 text-body-s text-secondary-text">{message}</p>}

      <section className="mt-8 border border-ink/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-ink">Instagram</h2>
          {status?.connection ? (
            <span className="text-caption text-tan-gold">● Connected</span>
          ) : (
            <span className="text-caption text-secondary-text">○ Not connected</span>
          )}
        </div>

        {!status && <p className="mt-3 text-body-s text-secondary-text">Loading…</p>}

        {status?.connection && (
          <div className="mt-3 space-y-3">
            <p className="text-body-s text-ink">
              Posting as{" "}
              <a href={`https://www.instagram.com/${status.connection.username}`} target="_blank" rel="noreferrer" className="font-bold underline">
                @{status.connection.username}
              </a>
              <span className="text-secondary-text"> · access renews automatically ({status.connection.daysLeft} days left)</span>
            </p>
            <div className="flex gap-3">
              <a href="/api/admin/instagram/connect" className={BUTTON}>Reconnect</a>
              <button type="button" onClick={disconnect} className="text-caption text-secondary-text underline">
                Disconnect
              </button>
            </div>

            <div className="border-t border-divider pt-3">
              <p className="text-micro uppercase tracking-[0.1em] text-secondary-text/70">Latest posts</p>
              {postsError && <p className="mt-2 text-caption text-paint-orange">{postsError}</p>}
              {!posts && !postsError && <p className="mt-2 text-caption text-secondary-text">Loading…</p>}
              {posts && posts.length === 0 && <p className="mt-2 text-caption text-secondary-text">No posts yet.</p>}
              <ul className="mt-2 space-y-2">
                {posts?.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-4 text-caption">
                    <a href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="line-clamp-1 text-ink underline">
                      {p.caption?.split("\n")[0] || p.mediaType}
                    </a>
                    <span className="shrink-0 text-secondary-text">
                      {new Date(p.timestamp).toLocaleDateString("en-IN")} · reach {p.reach ?? "—"} · {p.interactions ?? "—"} interactions
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {status && !status.connection && status.appConfigured && (
          <div className="mt-4">
            <a href="/api/admin/instagram/connect" className={BUTTON}>Connect Instagram</a>
            <p className="mt-2 text-caption text-secondary-text">
              You&apos;ll log into Instagram, approve, and come straight back here.
            </p>
            <button type="button" onClick={() => setStatus({ ...status, appConfigured: false })} className="mt-3 text-caption text-secondary-text underline">
              Change app ID / secret
            </button>
          </div>
        )}

        {status && !status.connection && !status.appConfigured && (
          <form onSubmit={saveApp} className="mt-4 space-y-3">
            <p className="text-caption text-secondary-text">
              One-time setup. Copy this redirect URL into your Meta app&apos;s Instagram login settings, then paste the
              Instagram app ID and secret shown there.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate border border-divider bg-surface-alt px-3 py-2 text-caption text-ink">{status.redirectUri}</code>
              <button
                type="button"
                className={BUTTON}
                onClick={() => {
                  navigator.clipboard.writeText(status.redirectUri);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <input placeholder="Instagram app ID" value={appId} onChange={(e) => setAppId(e.target.value)} className={INPUT} />
            <input type="password" placeholder="Instagram app secret" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} className={INPUT} />
            <button type="submit" disabled={saving || !appId || !appSecret} className={BUTTON}>
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 border border-dashed border-ink/20 p-5">
        <h2 className="font-sans text-body-m font-bold uppercase tracking-[0.03em] text-secondary-text">Facebook Page</h2>
        <p className="mt-1 text-caption text-secondary-text">Coming later — Instagram first.</p>
      </section>
    </main>
  );
}

export default function AdminSocialPage() {
  return (
    <Suspense fallback={null}>
      <SocialPage />
    </Suspense>
  );
}
