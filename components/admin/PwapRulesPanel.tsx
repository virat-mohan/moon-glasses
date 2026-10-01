"use client";

import { useEffect, useState } from "react";
import type { PwapRules } from "@/lib/pwap-rules";

type Field = { key: keyof PwapRules; label: string; hint: string; suffix?: string };

const MAIN: Field[] = [
  { key: "salesToShip", label: "Sales to ship their pair", hint: "Friends who must buy with the customer's code before their own pair ships free." },
  { key: "salesPerFreeCode", label: "Sales per free code", hint: "After their pair ships, every this many more sales sends them a free-pair code." },
  { key: "freeCodeValueRupees", label: "Free code value", hint: "Flat discount on the free code. Keep it at or above the dearest pair.", suffix: "₹" },
  { key: "freeCodeValidDays", label: "Free code valid for", hint: "Days before an unused free code expires.", suffix: "days" },
  { key: "friendDiscountRupees", label: "Friend discount", hint: "Off for a friend who buys with the code. 0 = full price.", suffix: "₹" },
];

const SHIP_FIRST: Field[] = [
  { key: "shipFirstMinFollowers", label: "Followers needed", hint: "Accounts at or above this get their pair before posting." },
  { key: "shipFirstDailyCap", label: "Max per day", hint: "Ship-first orders accepted per day; the rest post first." },
  { key: "shipFirstCooldownDays", label: "Once per account every", hint: "Days before the same Instagram account can ship-first again.", suffix: "days" },
  { key: "shipFirstMinPosts", label: "Min posts on account", hint: "Real-account check." },
  { key: "shipFirstMinMedianLikes", label: "Min median likes", hint: "Real-audience check on the latest 12 posts." },
  { key: "shipFirstMinLikesPct", label: "Min likes as % of followers", hint: "Catches bought followers.", suffix: "%" },
];

/** Admin › Pay With A Post: every rule of the programme, editable in one place. */
export function PwapRulesPanel() {
  const [rules, setRules] = useState<PwapRules | null>(null);
  const [saved, setSaved] = useState<PwapRules | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/admin/post-barter/rules")
      .then((r) => r.json())
      .then((d) => {
        setRules(d.rules);
        setSaved(d.rules);
      })
      .catch(() => setStatus("error"));
  }, []);

  if (!rules) return <p className="text-caption text-secondary-text">Loading rules…</p>;
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/post-barter/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRules(d.rules);
      setSaved(d.rules);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  function input(f: Field) {
    return (
      <label key={f.key} className="block border border-divider p-3">
        <span className="block text-caption font-bold uppercase tracking-[0.05em] text-ink">{f.label}</span>
        <span className="mt-2 flex items-center gap-2">
          {f.suffix === "₹" && <span className="text-body-s text-secondary-text">₹</span>}
          <input
            type="number"
            min={0}
            step={f.key === "shipFirstMinLikesPct" ? 0.1 : 1}
            value={rules![f.key] as number}
            onChange={(e) => setRules({ ...rules!, [f.key]: Number(e.target.value) })}
            className="w-28 border border-ink/30 bg-surface px-2 py-1.5 text-body-s text-ink outline-none focus:border-ink"
          />
          {f.suffix && f.suffix !== "₹" && <span className="text-body-s text-secondary-text">{f.suffix}</span>}
        </span>
        <span className="mt-1.5 block text-micro text-secondary-text">{f.hint}</span>
      </label>
    );
  }

  return (
    <div>
      <p className="text-body-s text-ink">
        Today: <strong>{rules.salesToShip} sales</strong> ship their pair free, then every{" "}
        <strong>{rules.salesPerFreeCode} more</strong> sends a free code worth <strong>₹{rules.freeCodeValueRupees.toLocaleString("en-IN")}</strong>{" "}
        (valid {rules.freeCodeValidDays} days).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MAIN.map(input)}</div>

      <label className="mt-6 flex items-center gap-3">
        <input
          type="checkbox"
          checked={rules.shipFirstEnabled}
          onChange={(e) => setRules({ ...rules, shipFirstEnabled: e.target.checked })}
          className="h-5 w-5 accent-[var(--moon-gold)]"
        />
        <span className="text-body-s font-bold uppercase tracking-[0.05em] text-ink">
          &ldquo;We ship first&rdquo; for big accounts {rules.shipFirstEnabled ? "(on)" : "(off)"}
        </span>
      </label>
      {rules.shipFirstEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SHIP_FIRST.map(input)}</div>}

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === "saving"}
          className="bg-[var(--moon-gold)] px-6 py-3 text-caption font-bold uppercase tracking-[0.08em] text-black disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save rules"}
        </button>
        {status === "saved" && !dirty && <span className="text-caption text-secondary-text">Saved. New orders use these rules.</span>}
        {status === "error" && <span className="text-caption text-red-500">Could not save. Try again.</span>}
      </div>
    </div>
  );
}
