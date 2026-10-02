"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  username: string | null;
  permalink: string | null;
  caption: string | null;
  imageUrl: string | null;
  mediaType: string;
  storyStatus: { status?: string; reason?: string } | null;
  grid: { status: string; postId?: string; at: string; reason?: string } | null;
  canPost: boolean;
  createdAt: string;
};

const BUTTON =
  "min-h-[44px] border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50";

export default function TaggedPostsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/tagged-posts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setMessage(d.error);
        setItems(d.items);
        setReadError(d.readError);
      })
      .catch(() => setMessage("Could not load tagged posts"));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, what: "approve" | "skip") {
    if (what === "approve" && !window.confirm("Post this photo on our grid? Only do this with the owner's OK.")) return;
    setBusy(id);
    setMessage(null);
    const res = await fetch(`/api/admin/tagged-posts/${id}/${what}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setMessage(res.ok ? (what === "approve" ? "Posted to the grid." : "Skipped.") : d.error ?? "Failed");
    load();
  }

  const waiting = (items ?? []).filter((i) => !i.grid || i.grid.status === "failed");
  const history = (items ?? []).filter((i) => i.grid && (i.grid.status === "posted" || i.grid.status === "skipped" || i.grid.status === "posting"));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="font-display text-h2 text-ink">Tagged posts{items ? ` (${waiting.length} waiting)` : ""}</h1>
        <p className="mt-2 text-body-s text-ink/80">Stories are reshared automatically. Nothing goes on our grid until you approve it here.</p>
        <p className="mt-2 border border-ink/30 bg-surface p-3 text-body-s text-ink">
          Only post with the owner&apos;s OK: a tag isn&apos;t permission to repost. A friendly comment or DM first is best.
        </p>
      </header>

      {readError && (
        <p className="border border-red-700 bg-surface p-3 text-body-s text-red-700">
          Instagram isn&apos;t letting us read tags yet. Needs the Facebook Page link + Instagram Business Account ID in Settings.
          <span className="mt-1 block break-words text-caption opacity-80">Last error: {readError}</span>
        </p>
      )}
      {message && <p className="text-body-s text-ink" role="status">{message}</p>}
      {!items && <p className="text-body-s">Loading…</p>}
      {items && waiting.length === 0 && <p className="text-body-s text-ink/70">Nothing waiting.</p>}

      <ul className="space-y-4">
        {waiting.map((i) => (
          <li key={i.id} className="space-y-3 border border-ink/30 p-3">
            {i.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.imageUrl} alt="" loading="lazy" className="aspect-square w-full bg-surface object-contain" />
            )}
            <p className="font-bold">@{i.username ?? "unknown"} {i.mediaType === "VIDEO" && <span className="text-caption font-normal">(video/reel)</span>}</p>
            {i.caption && <p className="whitespace-pre-wrap break-words text-body-s text-ink/80">{i.caption}</p>}
            <p className="text-caption text-ink/70">
              Story reshare: {i.storyStatus?.status ?? "none"}
              {i.storyStatus?.reason ? ` (${i.storyStatus.reason})` : ""}
            </p>
            {i.grid?.status === "failed" && <p className="text-caption text-red-700">Last grid attempt failed: {i.grid.reason}</p>}
            <div className="flex flex-wrap gap-2">
              {i.permalink && (
                <a href={i.permalink} target="_blank" rel="noreferrer" className={BUTTON + " inline-flex items-center"}>
                  Open on Instagram
                </a>
              )}
              {i.canPost && (
                <button className={BUTTON} disabled={busy === i.id} onClick={() => act(i.id, "approve")}>
                  Post to our grid
                </button>
              )}
              <button className={BUTTON} disabled={busy === i.id} onClick={() => act(i.id, "skip")}>
                Skip
              </button>
            </div>
          </li>
        ))}
      </ul>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-h3 text-ink">Posted / Skipped</h2>
          <ul className="space-y-2">
            {history.map((i) => (
              <li key={i.id} className="flex items-center gap-3 border border-ink/20 p-2 text-body-s">
                {i.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt="" loading="lazy" className="h-14 w-14 object-cover" />
                )}
                <span className="min-w-0 flex-1 break-words">
                  @{i.username ?? "unknown"} · <strong>{i.grid!.status}</strong> · {new Date(i.grid!.at).toLocaleDateString("en-IN")}
                </span>
                {i.permalink && (
                  <a href={i.permalink} target="_blank" rel="noreferrer" className="underline">
                    Original
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
