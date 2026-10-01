"use client";

import { useEffect, useState } from "react";
import type { PwapRules } from "@/lib/pwap-rules";
import type { PwapEconomicsInputs } from "@/lib/pwap-economics";

type Field = { key: keyof PwapRules; label: string; hint: string; suffix?: string };

const MAIN: Field[] = [
  { key: "salesToShip", label: "Sales to ship their pair", hint: "Friends who must buy with the customer's code before their own pair ships free." },
  { key: "salesPerFreeCode", label: "Sales per free code", hint: "After their pair ships, every this many more sales sends them a free-pair code." },
  { key: "freeCodeValueRupees", label: "Free code value", hint: "Flat discount on the free code. Keep it at or above the dearest pair.", suffix: "₹" },
  { key: "freeCodeValidDays", label: "Free code valid for", hint: "Days before an unused free code expires.", suffix: "days" },
  { key: "friendDiscountRupees", label: "Friend discount", hint: "Off for a friend who buys with the code. 0 = full price.", suffix: "₹" },
  { key: "shipCostRupees", label: "Our cost to ship a pair", hint: "Courier + packaging, for the money view below. Use the Shiprocket rate card.", suffix: "₹" },
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
  const [economics, setEconomics] = useState<PwapEconomicsInputs | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/admin/post-barter/rules")
      .then((r) => r.json())
      .then((d) => {
        setRules(d.rules);
        setSaved(d.rules);
        setEconomics(d.economics ?? null);
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

      {economics && <MoneyView rules={rules} e={economics} />}

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

const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

/**
 * What one Pay With A Post cycle does to the money, at the average pair
 * (real sales mix once there is one). Recomputes as the rules are edited.
 * Per cycle: the customer gets one pair free (our product + shipping cost);
 * friends buy `sales` pairs at full price minus any friend discount; we keep
 * the price ex-GST minus product + shipping cost on each of those.
 */
function cycle(sales: number, r: PwapRules, e: PwapEconomicsInputs) {
  const netPrice = (e.avgPrice - r.friendDiscountRupees) / (1 + e.gstRate);
  const marginPerSale = netPrice - e.avgCost - r.shipCostRupees;
  const promoCost = e.avgCost + r.shipCostRupees;
  const revenue = sales * netPrice;
  const profit = sales * marginPerSale - promoCost;
  return {
    sales,
    revenue,
    promoCost,
    promoPct: revenue > 0 ? (promoCost / revenue) * 100 : 0,
    costPerBuyer: promoCost / sales,
    profit,
    marginPerSale,
  };
}

function MoneyView({ rules: r, e }: { rules: PwapRules; e: PwapEconomicsInputs }) {
  const now = cycle(r.salesToShip, r, e);
  const free = cycle(r.salesPerFreeCode, r, e);
  const options = [1, 2, 3, 4, 5].map((n) => cycle(n, r, e));
  const breakEven = Math.ceil((e.avgCost + r.shipCostRupees) / Math.max(1, now.marginPerSale));

  return (
    <div className="mt-6 border border-[var(--moon-gold)] p-4">
      <p className="text-body-s font-bold uppercase tracking-[0.05em] text-ink">Money view</p>
      <p className="mt-1 text-micro text-secondary-text">
        Average pair {inr(e.avgPrice)} (incl. GST), costs us {inr(e.avgCost)} + {inr(r.shipCostRupees)} shipping.{" "}
        {e.source === "sales"
          ? `From the real mix of ${e.basis} pairs sold in the last 90 days.`
          : `Catalogue average of ${e.basis} products; switches to your real sales mix after 10 paid pairs.`}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="bg-surface-alt p-3">
          <p className="text-caption font-bold uppercase text-ink">Each free pair ({r.salesToShip} sales)</p>
          <ul className="mt-2 space-y-1 text-caption text-secondary-text">
            <li>
              Friends&apos; sales bring in <strong className="text-ink">{inr(now.revenue)}</strong> (ex-GST)
            </li>
            <li>
              The free pair costs us <strong className="text-ink">{inr(now.promoCost)}</strong> ={" "}
              <strong className="text-ink">{now.promoPct.toFixed(0)}%</strong> of that
            </li>
            <li>
              = <strong className="text-ink">{inr(now.costPerBuyer)}</strong> per new buyer
            </li>
            <li>
              We keep <strong className={now.profit >= 0 ? "text-ink" : "text-red-500"}>{inr(now.profit)}</strong> after
              all costs
            </li>
          </ul>
        </div>
        <div className="bg-surface-alt p-3">
          <p className="text-caption font-bold uppercase text-ink">Each free code ({r.salesPerFreeCode} more sales)</p>
          <ul className="mt-2 space-y-1 text-caption text-secondary-text">
            <li>
              Sales bring in <strong className="text-ink">{inr(free.revenue)}</strong>; the pair costs{" "}
              <strong className="text-ink">{inr(free.promoCost)}</strong> ({free.promoPct.toFixed(0)}%)
            </li>
            <li>
              We keep <strong className={free.profit >= 0 ? "text-ink" : "text-red-500"}>{inr(free.profit)}</strong>
            </li>
            <li>
              Code is worth up to {inr(r.freeCodeValueRupees)} to them; costs us only the pair it&apos;s used on.
            </li>
          </ul>
        </div>
      </div>

      <table className="mt-4 w-full text-left text-caption">
        <thead className="text-secondary-text">
          <tr>
            <th className="py-1 font-normal">Sales to ship</th>
            <th className="py-1 font-normal">Promo cost</th>
            <th className="py-1 font-normal">% of sales</th>
            <th className="py-1 font-normal">Per new buyer</th>
            <th className="py-1 font-normal">We keep</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => (
            <tr key={o.sales} className={o.sales === r.salesToShip ? "font-bold text-ink" : "text-secondary-text"}>
              <td className="py-1">
                {o.sales}
                {o.sales === r.salesToShip ? " (now)" : ""}
              </td>
              <td className="py-1">{inr(o.promoCost)}</td>
              <td className="py-1">{o.promoPct.toFixed(0)}%</td>
              <td className="py-1">{inr(o.costPerBuyer)}</td>
              <td className={`py-1 ${o.profit < 0 ? "text-red-500" : ""}`}>{inr(o.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-micro text-secondary-text">
        Break-even: {breakEven} sale{breakEven === 1 ? "" : "s"} pay for one free pair. Product cost uses actual vendor
        cost where entered, else the 25% target. Doesn&apos;t include the value of the posts themselves.
      </p>
    </div>
  );
}
