"use client";

import { useEffect, useState } from "react";

type Action = {
  id: string;
  ad_brief_id: string;
  action: string;
  reason: string;
  before_value: string | null;
  after_value: string | null;
  created_at: string;
  ad_briefs: { headline: string } | null;
};

type Recommendation = { area: "ads" | "organic" | "whatsapp" | "traffic"; summary: string; detail: string };

const AREA_LABEL: Record<Recommendation["area"], string> = {
  ads: "Ads",
  organic: "Organic / Instagram",
  whatsapp: "WhatsApp",
  traffic: "Site Traffic",
};

export default function AgentLogPage() {
  const [enabled, setEnabled] = useState(false);
  const [maxBudget, setMaxBudget] = useState(1000);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function load() {
    Promise.all([
      fetch("/api/admin/agent-config").then((r) => r.json()),
      fetch("/api/admin/agent-log").then((r) => r.json()),
    ])
      .then(([config, log]) => {
        setEnabled(config.enabled);
        setMaxBudget(config.maxBudget);
        setActions(log.actions ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function loadRecommendations() {
    setRecsLoading(true);
    fetch("/api/admin/growth-recommendations")
      .then((res) => res.json())
      .then((data) => setRecommendations(data.recommendations ?? []))
      .finally(() => setRecsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadRecommendations, []);

  function copyPrompt(r: Recommendation, index: number) {
    const prompt = `Act on this growth recommendation from /admin/agent-log:\n\n"${r.summary}"\n\n${r.detail}\n\nPlease take the appropriate action in the codebase/admin (e.g. adjust a campaign, generate an ad brief, update a setting) and tell me what you did.`;
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 2000);
    });
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await fetch("/api/admin/agent-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
  }

  async function saveBudget() {
    await fetch("/api/admin/agent-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxBudget }),
    });
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/cron/ad-agent");
      const data = await res.json();
      if (data.skipped) {
        setRunResult("Agent is disabled — enable it above first.");
      } else {
        setRunResult(`Sweep complete — ${data.actions?.length ?? 0} campaign(s) reviewed.`);
      }
      load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Ad Agent</h1>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Reviews every launched campaign a human has already turned ACTIVE. It can pause a campaign
        that&apos;s clearly not working, or scale budget up on one that&apos;s working — capped,
        logged, and never allowed to activate anything itself.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-divider pt-6">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} className="h-4 w-4 accent-ink" />
          <span className="font-sans text-body-s uppercase tracking-[0.05em] text-ink">
            Agent Enabled
          </span>
        </label>

        <div className="flex items-center gap-3">
          <label className="text-caption text-secondary-text">Max daily budget per campaign ₹</label>
          <input
            type="number"
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value))}
            onBlur={saveBudget}
            className="w-24 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
          />
        </div>

        <button
          onClick={runNow}
          disabled={running}
          className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {running ? "Running..." : "Run Sweep Now"}
        </button>
        {runResult && <p className="text-caption text-secondary-text">{runResult}</p>}
      </div>

      <div className="mt-10 border-t border-divider pt-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-heading-s uppercase text-ink">Recommendations</h2>
          <button
            onClick={loadRecommendations}
            disabled={recsLoading}
            className="border border-divider px-4 py-1.5 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-50"
          >
            {recsLoading ? "Checking..." : "Refresh"}
          </button>
        </div>
        <p className="mt-2 max-w-xl text-body-s text-secondary-text">
          A read across site traffic, ad spend, WhatsApp performance, and organic Instagram
          engagement — advisory only, nothing here takes any action on its own.
        </p>
        {recsLoading ? (
          <p className="mt-4 text-body-s text-secondary-text">Checking every channel...</p>
        ) : recommendations.length === 0 ? (
          <p className="mt-4 text-body-s text-secondary-text">
            No standout signal right now — check back once there&apos;s more traffic/spend data.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {recommendations.map((r, i) => (
              <div key={i} className="border-t border-divider pt-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">
                    {AREA_LABEL[r.area]}
                  </span>
                  <button
                    onClick={() => copyPrompt(r, i)}
                    className="shrink-0 text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-ink"
                  >
                    {copiedIndex === i ? "Copied ✓" : "Copy Prompt"}
                  </button>
                </div>
                <p className="mt-1 font-sans text-body-s font-bold text-ink">{r.summary}</p>
                <p className="mt-1 text-caption text-secondary-text">{r.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 border-t border-divider pt-6">
        <h2 className="font-display text-heading-s uppercase text-ink">Action Log</h2>
        {loading ? (
          <p className="mt-4 text-body-s text-secondary-text">Loading...</p>
        ) : actions.length === 0 ? (
          <p className="mt-4 text-body-s text-secondary-text">No actions taken yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {actions.map((a) => (
              <div key={a.id} className="border-t border-divider pt-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-caption uppercase tracking-[0.05em] text-ink">
                    {a.ad_briefs?.headline ?? a.ad_brief_id}
                  </p>
                  <span
                    className={`text-micro uppercase tracking-[0.05em] ${
                      a.action === "paused"
                        ? "text-paint-orange"
                        : a.action === "budget_increased"
                          ? "text-tan-gold"
                          : "text-secondary-text"
                    }`}
                  >
                    {a.action.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-1 text-body-s text-secondary-text">{a.reason}</p>
                {a.before_value && (
                  <p className="mt-1 text-micro text-secondary-text/70">
                    {a.before_value} → {a.after_value}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
