"use client";

import { useEffect, useState } from "react";
import { arrow, deltaTone, describeDelta, formatValue, inr, PALETTE, plural, type Delta, type Digest, type Metric } from "@/lib/ops-digest-core";

// Same content as the morning email (lib/ops-digest-core.ts renders both), in
// the viratmohan.com poster look. Fonts come from the admin layout's Anton /
// Instrument Serif variables, with web-safe fallbacks.
const DISPLAY = "var(--adm-display, var(--admin-display)), Anton, 'Arial Narrow', sans-serif";
const SERIF = "var(--adm-serif, var(--admin-serif)), 'Instrument Serif', Georgia, serif";
const P = PALETTE;

function DeltaLine({ d, m, label }: { d: Delta | null; m: Metric; label: string }) {
  if (!d) return <p className="text-[12px]" style={{ color: P.dim }}>— {label}</p>;
  const t = deltaTone(d, m.upIsGood);
  return (
    <p className="text-[12px]">
      <span style={{ color: t === "good" ? P.good : t === "bad" ? P.bad : P.dim }}>
        {arrow(d.dir)} {describeDelta(d, m.format)}
      </span>{" "}
      <span style={{ color: P.dim }}>{label}</span>
    </p>
  );
}

function Title({ children, colour }: { children: string; colour: string }) {
  return (
    <h3 className="mb-3 mt-8 flex items-center gap-2.5 text-[20px] uppercase leading-none" style={{ fontFamily: DISPLAY, color: P.ink, fontWeight: 400 }}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: colour }} aria-hidden />
      {children}
    </h3>
  );
}

export function OpsDigestCard() {
  const [digest, setDigest] = useState<(Digest & { subject: string }) | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ops-digest")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setDigest)
      .catch(() => setError(true));
  }, []);

  const band = [P.terracotta, P.cobalt, P.magenta, P.gold, P.bronze];

  return (
    <section className="mb-10 overflow-hidden rounded-[14px] border" style={{ background: P.paper, borderColor: P.line, color: P.ink }}>
      <div className="grid grid-cols-5" aria-hidden>
        {band.map((c) => (
          <span key={c} className="h-1.5" style={{ background: c }} />
        ))}
      </div>
      <div className="p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: P.bronze }}>
            Morning digest
          </p>
          <div className="flex gap-3 text-[12px]" style={{ color: P.dim }}>
            <a href="/api/admin/ops-digest?format=html" target="_blank" rel="noopener" className="underline underline-offset-2">
              Preview email
            </a>
            <a href="/api/admin/ops-digest?format=text" target="_blank" rel="noopener" className="underline underline-offset-2">
              Plain text
            </a>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-[14px]" style={{ color: P.dim }}>I couldn&apos;t load the digest just now.</p>
        ) : !digest ? (
          <p className="mt-4 text-[14px]" style={{ color: P.dim }}>Loading…</p>
        ) : (
          <>
            <h2 className="mt-2 text-[34px] uppercase leading-[0.95] md:text-[40px]" style={{ fontFamily: DISPLAY, fontWeight: 400 }}>
              {digest.dayLabel}
            </h2>
            <p className="mt-3 max-w-[60ch] text-[20px] italic leading-snug" style={{ fontFamily: SERIF }}>
              {digest.headline}
            </p>
            <hr className="mt-5 border-0" style={{ height: 1, background: P.gold }} />

            {digest.scorecard.length > 0 && (
              <>
                <Title colour={P.terracotta}>Scorecard</Title>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {digest.scorecard.map((m) => (
                    <div key={m.key} className="rounded-xl border p-4" style={{ background: P.card, borderColor: P.line }}>
                      <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: P.dim }}>{m.label}</p>
                      <p className="mt-0.5 text-[28px] leading-tight" style={{ fontFamily: SERIF }}>{formatValue(m.value, m.format)}</p>
                      <DeltaLine d={m.vsWeek} m={m} label={`vs last ${digest.weekdayName.slice(0, 3)}`} />
                      <DeltaLine d={m.vsAvg} m={m} label="vs 7-day avg" />
                      {m.note && <p className="mt-1 text-[11px]" style={{ color: P.dim }}>{m.note}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <Title colour={P.gold}>Progress to goal</Title>
            {digest.goals.length ? (
              digest.goals.map((g) => {
                const pct = Math.min(100, Math.round((g.actual / g.target) * 100));
                return (
                  <div key={g.label} className="mb-4">
                    <p className="text-[14px]">{g.line}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: P.line }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.onTrack ? P.cobalt : P.terracotta }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[14px]" style={{ color: P.dim }}>{digest.goalNote}</p>
            )}

            {digest.insights.length > 0 && (
              <>
                <Title colour={P.cobalt}>What changed</Title>
                <ol className="space-y-4">
                  {digest.insights.map((ins, i) => (
                    <li key={ins.title} className="flex gap-3">
                      <span className="w-6 shrink-0 text-[26px] leading-none" style={{ fontFamily: SERIF, color: ins.tone === "good" ? P.cobalt : P.terracotta }}>{i + 1}</span>
                      <div>
                        <p className="text-[15px] font-semibold">{ins.title}</p>
                        <p className="text-[14px]">{ins.detail}</p>
                        {ins.why && <p className="mt-1 text-[16px] italic" style={{ fontFamily: SERIF, color: P.dim }}>Why: {ins.why}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}

            <Title colour={P.magenta}>Needs you today</Title>
            {digest.needs.length ? (
              <div className="space-y-2.5">
                {digest.needs.map((n) => (
                  <div key={n.key} className="rounded-[10px] border p-4" style={{ background: P.card, borderColor: P.line, borderLeft: `3px solid ${P.magenta}` }}>
                    <p className="text-[15px] font-semibold">
                      {n.title}
                      {n.money > 0 && <span className="font-normal" style={{ color: P.dim }}> · {inr(n.money)}</span>}
                    </p>
                    <p className="mt-1 text-[13px]"><span style={{ color: P.dim }}>Why:</span> {n.reason}</p>
                    <p className="text-[13px]"><span style={{ color: P.dim }}>Then:</span> {n.outcome}</p>
                    <a href={new URL(n.href).pathname} className="mt-2.5 inline-block rounded-full px-4 py-1.5 text-[13px] no-underline" style={{ background: P.ink, color: P.paper }}>
                      Open →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[18px] italic" style={{ fontFamily: SERIF, color: P.dim }}>Nothing is waiting on you this morning.</p>
            )}

            {digest.shipping && (
              <>
                <Title colour={P.bronze}>Shipping health</Title>
                <div className="grid grid-cols-4 gap-3">
                  {(
                    [
                      ["Delivered", digest.shipping.delivered, P.cobalt],
                      ["In transit", digest.shipping.inTransit + digest.shipping.awaitingPickup, P.bronze],
                      ["Stuck", digest.shipping.stuck + digest.shipping.ndr, P.magenta],
                      ["RTO", digest.shipping.rto, P.terracotta],
                    ] as const
                  ).map(([l, v, c]) => (
                    <div key={l} className="border-t-[3px] pt-2" style={{ borderColor: c }}>
                      <p className="text-[26px] leading-tight" style={{ fontFamily: SERIF }}>{v}</p>
                      <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: P.dim }}>{l}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[12px]" style={{ color: P.dim }}>Orders of the last {digest.shipping.windowDays} days that have shipped.</p>
              </>
            )}

            {digest.stock.length > 0 && (
              <>
                <Title colour={P.gold}>Stock on top sellers</Title>
                <ul>
                  {digest.stock.map((s) => {
                    const low = s.daysOfCover !== null && s.daysOfCover < 14;
                    return (
                      <li key={s.name} className="flex items-baseline justify-between gap-3 border-b py-2" style={{ borderColor: P.line }}>
                        <span className="text-[14px]">
                          {s.name}
                          <span className="block text-[12px]" style={{ color: P.dim }}>{s.stock} left · {s.unitsPerDay.toFixed(1)} a day</span>
                        </span>
                        <span className="whitespace-nowrap text-[14px]" style={{ color: low ? P.bad : P.ink, fontWeight: low ? 600 : 400 }}>
                          {s.stock <= 0 ? "sold out" : s.daysOfCover === null ? "—" : plural(Math.floor(s.daysOfCover), "day")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[12px]" style={{ color: P.dim }}>Days of cover at the last 14 days&apos; pace.</p>
              </>
            )}

            {digest.gaps.length > 0 && (
              <p className="mt-8 text-[12px]" style={{ color: P.dim }}>
                <strong className="font-semibold">Not in this digest:</strong> {digest.gaps.join(" ")}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
