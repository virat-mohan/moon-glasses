"use client";

import { useEffect, useState } from "react";

type Creator = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  instagram_handle: string;
  follower_count: number;
  category: string | null;
  city: string | null;
  status: string;
  score: number | null;
  score_reasons: string[] | null;
  recommendation: string | null;
  product_name: string | null;
  product_shipped_at: string | null;
  coupon_code: string | null;
  admin_notes: string | null;
  created_at: string;
};

type ContentRow = {
  id: string;
  post_url: string | null;
  media_type: string | null;
  likes: number | null;
  comments: number | null;
  reach: number | null;
  source: string;
  captured_at: string;
};

type TaggedMedia = {
  id: string;
  caption: string | null;
  permalink: string | null;
  mediaType: string;
  username: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  approved: "Approved — awaiting signature",
  rejected: "Rejected",
  agreement_sent: "Agreement sent",
  agreed: "Agreement signed",
  product_shipped: "Product shipped",
  content_received: "Content received",
  completed: "Completed",
};

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  applied: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ],
  approved: [{ status: "rejected", label: "Reject" }],
  rejected: [{ status: "approved", label: "Approve" }],
  agreed: [{ status: "product_shipped", label: "Mark Product Shipped" }],
  product_shipped: [{ status: "content_received", label: "Mark Content Received" }],
  content_received: [{ status: "completed", label: "Mark Completed" }],
  completed: [],
  agreement_sent: [],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/creators")
      .then((res) => res.json())
      .then((data) => setCreators(data.creators ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setStatus(id: string, status: string) {
    setCreators((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await fetch("/api/admin/creators", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function saveProductName(id: string, productName: string) {
    await fetch("/api/admin/creators", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, productName }),
    });
  }

  async function saveNotes(id: string, adminNotes: string) {
    await fetch("/api/admin/creators", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, adminNotes }),
    });
  }

  const applied = creators
    .filter((c) => c.status === "applied")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const inProgress = creators.filter((c) =>
    ["approved", "agreement_sent", "agreed", "product_shipped", "content_received"].includes(c.status)
  );
  const done = creators.filter((c) => ["completed", "rejected"].includes(c.status));

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Creators</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Every applicant is auto-scored the moment they apply — the agent only recommends, you make
        the call.
      </p>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading…</p>
      ) : (
        <>
          <Section title={`New Applications (${applied.length})`}>
            {applied.length === 0 ? (
              <Empty text="Nothing waiting for review." />
            ) : (
              applied.map((c) => (
                <CreatorCard
                  key={c.id}
                  creator={c}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onSetStatus={setStatus}
                  onSaveProductName={saveProductName}
                  onSaveNotes={saveNotes}
                />
              ))
            )}
          </Section>

          <Section title={`In Progress (${inProgress.length})`}>
            {inProgress.length === 0 ? (
              <Empty text="Nobody in the pipeline right now." />
            ) : (
              inProgress.map((c) => (
                <CreatorCard
                  key={c.id}
                  creator={c}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onSetStatus={setStatus}
                  onSaveProductName={saveProductName}
                  onSaveNotes={saveNotes}
                />
              ))
            )}
          </Section>

          <Section title={`Completed / Rejected (${done.length})`}>
            {done.length === 0 ? (
              <Empty text="Nothing here yet." />
            ) : (
              done.map((c) => (
                <CreatorCard
                  key={c.id}
                  creator={c}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onSetStatus={setStatus}
                  onSaveProductName={saveProductName}
                  onSaveNotes={saveNotes}
                />
              ))
            )}
          </Section>
        </>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-heading-s uppercase text-ink">{title}</h2>
      <div className="mt-4 space-y-6">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-body-s text-secondary-text">{text}</p>;
}

function CreatorCard({
  creator,
  expanded,
  onToggle,
  onSetStatus,
  onSaveProductName,
  onSaveNotes,
}: {
  creator: Creator;
  expanded: boolean;
  onToggle: () => void;
  onSetStatus: (id: string, status: string) => void;
  onSaveProductName: (id: string, productName: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [productName, setProductName] = useState(creator.product_name ?? "");
  const [notes, setNotes] = useState(creator.admin_notes ?? "");

  return (
    <div className="border-t border-divider pt-6">
      <button onClick={onToggle} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <p className="text-body-s font-bold text-ink">
            {creator.name} · @{creator.instagram_handle.replace(/^@/, "")}
          </p>
          <p className="mt-1 text-caption text-secondary-text">
            {creator.follower_count.toLocaleString("en-IN")} followers · {creator.category || "no category"} ·{" "}
            {creator.city || "no city"} · applied {formatDate(creator.created_at)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {creator.score != null && (
            <p className="text-caption text-ink">
              Score {creator.score}/100 ·{" "}
              <span
                className={
                  creator.recommendation === "approve"
                    ? "text-tan-gold"
                    : creator.recommendation === "reject"
                      ? "text-red-500"
                      : "text-secondary-text"
                }
              >
                {creator.recommendation?.toUpperCase()}
              </span>
            </p>
          )}
          <p className="mt-1 text-micro uppercase tracking-[0.05em] text-secondary-text">
            {STATUS_LABEL[creator.status] ?? creator.status}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-caption text-secondary-text">
            {creator.email} {creator.phone ? `· ${creator.phone}` : ""}
          </p>

          {creator.score_reasons && creator.score_reasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-caption text-secondary-text">
              {creator.score_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-caption text-secondary-text">
              Product:{" "}
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onBlur={() => onSaveProductName(creator.id, productName)}
                placeholder="e.g. Moon Aviator — Black/Yellow"
                className="border border-divider bg-transparent px-2 py-1 text-caption text-ink focus:border-ink focus:outline-none"
              />
            </label>
            {creator.coupon_code && (
              <span className="text-caption text-secondary-text">
                Coupon: <strong className="text-ink">{creator.coupon_code}</strong>
              </span>
            )}
          </div>

          <label className="block text-caption text-secondary-text">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => onSaveNotes(creator.id, notes)}
              rows={2}
              className="mt-1 block w-full border border-divider bg-transparent px-2 py-1.5 text-caption text-ink focus:border-ink focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            {(NEXT_STATUS[creator.status] ?? []).map((next) => (
              <button
                key={next.status}
                onClick={() => onSetStatus(creator.id, next.status)}
                className={
                  next.status === "rejected"
                    ? "border border-divider px-4 py-1.5 text-caption uppercase tracking-[0.05em] text-secondary-text"
                    : "border border-ink bg-ink px-4 py-1.5 text-caption font-bold uppercase tracking-[0.05em] text-cream"
                }
              >
                {next.label}
              </button>
            ))}
          </div>

          {["product_shipped", "content_received", "completed"].includes(creator.status) && (
            <CreatorContentPanel creatorId={creator.id} />
          )}
        </div>
      )}
    </div>
  );
}

function CreatorContentPanel({ creatorId }: { creatorId: string }) {
  const [linked, setLinked] = useState<ContentRow[]>([]);
  const [tagged, setTagged] = useState<TaggedMedia[]>([]);
  const [taggedError, setTaggedError] = useState<string | null>(null);
  const [manual, setManual] = useState({ postUrl: "", likes: "", comments: "", mediaType: "feed" });

  useEffect(() => {
    fetch(`/api/admin/creators/content?creatorId=${creatorId}`)
      .then((r) => r.json())
      .then((d) => setLinked(d.content ?? []));
    fetch("/api/admin/creators/content")
      .then((r) => r.json())
      .then((d) => {
        setTagged(d.tagged ?? []);
        if (d.error) setTaggedError(d.error);
      });
  }, [creatorId]);

  async function link(payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/creators/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId, ...payload }),
    });
    if (res.ok) {
      const data = await res.json();
      setLinked((prev) => [data.content, ...prev]);
    }
  }

  return (
    <div className="border-t border-divider pt-4">
      <p className="text-micro uppercase tracking-[0.1em] text-secondary-text">Content</p>

      {linked.length > 0 && (
        <ul className="mt-2 space-y-1 text-caption text-secondary-text">
          {linked.map((c) => (
            <li key={c.id}>
              {c.post_url ? (
                <a href={c.post_url} target="_blank" rel="noreferrer" className="underline">
                  {c.post_url}
                </a>
              ) : (
                "(no link)"
              )}{" "}
              — {c.likes ?? 0} likes, {c.comments ?? 0} comments ({c.source === "instagram_tags" ? "auto-picked-up" : "manual"})
            </li>
          ))}
        </ul>
      )}

      {tagged.length > 0 && (
        <div className="mt-3">
          <p className="text-caption text-secondary-text">Recently tagged/collab posts on our Instagram:</p>
          <ul className="mt-1 space-y-1">
            {tagged.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-caption">
                <span className="truncate text-secondary-text">
                  @{t.username ?? "unknown"} · {t.likeCount ?? 0} likes ·{" "}
                  {new Date(t.timestamp).toLocaleDateString("en-IN")}
                </span>
                <button
                  onClick={() =>
                    link({
                      postUrl: t.permalink,
                      mediaType: t.mediaType?.toLowerCase(),
                      likes: t.likeCount,
                      comments: t.commentsCount,
                      caption: t.caption,
                      postedAt: t.timestamp,
                      source: "instagram_tags",
                    })
                  }
                  className="shrink-0 border border-divider px-2 py-0.5 text-micro uppercase text-ink"
                >
                  Link to this creator
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {taggedError && <p className="mt-2 text-caption text-secondary-text">{taggedError}</p>}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input
          placeholder="Post URL"
          value={manual.postUrl}
          onChange={(e) => setManual({ ...manual, postUrl: e.target.value })}
          className="border border-divider bg-transparent px-2 py-1 text-caption text-ink focus:border-ink focus:outline-none"
        />
        <input
          placeholder="Likes"
          value={manual.likes}
          onChange={(e) => setManual({ ...manual, likes: e.target.value })}
          className="w-20 border border-divider bg-transparent px-2 py-1 text-caption text-ink focus:border-ink focus:outline-none"
        />
        <input
          placeholder="Comments"
          value={manual.comments}
          onChange={(e) => setManual({ ...manual, comments: e.target.value })}
          className="w-24 border border-divider bg-transparent px-2 py-1 text-caption text-ink focus:border-ink focus:outline-none"
        />
        <button
          onClick={async () => {
            await link({ ...manual, source: "manual" });
            setManual({ postUrl: "", likes: "", comments: "", mediaType: "feed" });
          }}
          className="border border-divider px-3 py-1 text-caption uppercase text-ink"
        >
          Add manually
        </button>
      </div>
    </div>
  );
}
