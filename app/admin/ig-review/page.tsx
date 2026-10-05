"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Finding = { level: string; rule: string; match: string; fix: string };
type Item = {
  id: string; position: number; name: string; price: number; collection: string; url: string; caption: string;
  slides: string[]; story: string; feed_at: string; story_at: string; status: "review" | "approved" | "held";
  flags: string[]; voice: { ok: boolean; findings: Finding[] }; edited: boolean;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const BTN = "min-h-[44px] rounded-full border border-[var(--adm-fg)] px-5 text-[15px] font-medium disabled:opacity-50";
const STATUS: Record<Item["status"], string> = { review: "In review", approved: "Approved", held: "On hold" };

export default function IgReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [slots, setSlots] = useState("");
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | Item["status"]>("all");

  const load = useCallback(() => {
    fetch("/api/admin/ig-review").then((r) => r.json()).then((d) => { setItems(d.items ?? []); setSlots(d.slots ?? ""); setDbError(d.dbError ?? null); })
      .catch(() => setMsg("Could not load the queue")).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function decide(ids: string[], status: Item["status"], caption?: string) {
    setBusy(ids.join(",")); setMsg(null);
    try {
      const res = await fetch("/api/admin/ig-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status, caption }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setEdit((e) => { const n = { ...e }; ids.forEach((i) => delete n[i]); return n; });
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(null); }
  }

  const counts = useMemo(() => ({ review: items.filter((i) => i.status === "review").length, approved: items.filter((i) => i.status === "approved").length, held: items.filter((i) => i.status === "held").length }), [items]);
  const shown = items.filter((i) => filter === "all" || i.status === filter);
  const approvable = items.filter((i) => i.status === "review" && i.voice.ok).map((i) => i.id);

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 sm:px-6">
      <p className="text-[13px] uppercase tracking-[0.14em] text-[var(--adm-accent)]">Marketing</p>
      <h1 className="adm-serif mt-1 text-[34px] leading-tight sm:text-[44px]">Instagram review queue</h1>
      <p className="mt-2 max-w-[60ch] text-[16px] text-[var(--adm-dim)]">
        One product at a time on @moonglassesonline: a two-slide carousel and a story with a link sticker. I review everything here first. Nothing is posted from this page.
      </p>
      <p className="mt-2 text-[15px] text-[var(--adm-dim)]">Proposed times (IST): {slots}.</p>

      {dbError && <p className="mt-4 rounded-lg border border-[var(--adm-hair)] bg-[var(--adm-surface)] p-3 text-[15px]">Decisions can not be saved yet: the review table is not set up. You can still read everything below.</p>}
      {msg && <p className="mt-4 text-[15px] text-[var(--adm-danger)]" role="alert">{msg}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "review", "approved", "held"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`min-h-[44px] rounded-full border px-4 text-[15px] ${filter === f ? "border-[var(--adm-solid)] bg-[var(--adm-solid)] text-[var(--adm-on-solid)]" : "border-[var(--adm-hair)]"}`}>
            {f === "all" ? `All ${items.length}` : `${STATUS[f]} ${counts[f]}`}
          </button>
        ))}
        <button className={`${BTN} ml-auto`} disabled={!approvable.length || !!busy || !!dbError} onClick={() => decide(approvable, "approved")}>
          Approve all that pass ({approvable.length})
        </button>
      </div>

      {loading && <p className="mt-10 text-[var(--adm-dim)]">Loading the queue.</p>}

      <ul className="mt-6 grid gap-5">
        {shown.map((it) => {
          const draft = edit[it.id];
          const isBusy = busy?.includes(it.id);
          return (
            <li key={it.id} className="rounded-2xl border border-[var(--adm-hair)] bg-[var(--adm-surface)] p-4 shadow-[var(--adm-shadow)] sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="adm-serif text-[24px]">{it.position}. {it.name}</h2>
                <span className="text-[14px] text-[var(--adm-dim)]">{STATUS[it.status]} · {it.collection} · ₹{it.price.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="grid grid-cols-3 gap-2" aria-label="Slide 1, slide 2 and story">
                  {[it.slides[0], it.slides[1]].map((s, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={s} src={s} alt={`${it.name}, slide ${i + 1}`} loading="lazy" className="aspect-[4/5] w-full rounded-lg object-cover" />
                  ))}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.story} alt={`${it.name}, story`} loading="lazy" className="aspect-[9/16] w-full rounded-lg object-cover" />
                </div>
                <div>
                  <p className="text-[14px] text-[var(--adm-dim)]">Feed {when(it.feed_at)} · story {when(it.story_at)}</p>
                  <label className="mt-2 block text-[14px] text-[var(--adm-dim)]" htmlFor={`c-${it.id}`}>Caption{it.edited ? " (edited)" : ""}</label>
                  <textarea id={`c-${it.id}`} value={draft ?? it.caption} onChange={(e) => setEdit((x) => ({ ...x, [it.id]: e.target.value }))} rows={9}
                    className="mt-1 w-full rounded-lg border border-[var(--adm-hair)] bg-white/60 p-3 text-[16px] leading-relaxed" />
                  <p className="mt-1 text-[14px] text-[var(--adm-dim)]">{(draft ?? it.caption).length} of 300 characters · story link sticker: &ldquo;Make it yours&rdquo; to the product page</p>
                  {it.voice.findings.map((f) => <p key={f.rule + f.match} className="mt-1 text-[14px] text-[var(--adm-danger)]">{f.level === "block" ? "Blocked" : "Check"}: {f.fix}</p>)}
                  {it.flags.map((f) => <p key={f} className="mt-1 text-[14px] text-[var(--adm-accent)]">Flag: {f}</p>)}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {draft !== undefined && <button className={BTN} disabled={!!busy || !!dbError} onClick={() => decide([it.id], it.status, draft)}>Save caption</button>}
                    <button className={`${BTN} bg-[var(--adm-solid)] text-[var(--adm-on-solid)]`} disabled={!!busy || !!dbError || it.status === "approved" || !it.voice.ok} onClick={() => decide([it.id], "approved", draft)}>{isBusy ? "Saving" : "Approve"}</button>
                    <button className={BTN} disabled={!!busy || !!dbError || it.status === "held"} onClick={() => decide([it.id], "held")}>Hold</button>
                    <a className={`${BTN} inline-flex items-center`} href={it.url} target="_blank" rel="noreferrer">Open product</a>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
