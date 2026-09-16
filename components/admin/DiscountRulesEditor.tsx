"use client";

import { useState } from "react";

type Rule = { id: string; name: string; buy_quantity: number; discount_percent: number; active: boolean };
type Redemption = {
  id: string;
  order_id: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  discount_amount: number;
  redeemed_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function DiscountRulesEditor({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", buyQuantity: 3, discountPercent: 50 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  async function toggleRedemptions(ruleId: string) {
    if (expandedId === ruleId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ruleId);
    setLoadingRedemptions(true);
    try {
      const res = await fetch(`/api/admin/discount-rules/${ruleId}`);
      const data = await res.json();
      setRedemptions(data.redemptions ?? []);
    } finally {
      setLoadingRedemptions(false);
    }
  }

  async function updateRule(id: string, patch: Partial<Rule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch("/api/admin/discount-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: patch.name,
        buyQuantity: patch.buy_quantity,
        discountPercent: patch.discount_percent,
        active: patch.active,
      }),
    });
  }

  async function removeRule(id: string) {
    if (!confirm("Remove this discount rule? This can't be undone.")) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/admin/discount-rules?id=${id}`, { method: "DELETE" });
  }

  async function createRule() {
    if (!draft.name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/discount-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          buyQuantity: draft.buyQuantity,
          discountPercent: draft.discountPercent,
          active: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRules((prev) => [...prev, data.rule]);
        setDraft({ name: "", buyQuantity: 3, discountPercent: 50 });
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {rules.map((r) => (
        <div key={r.id} className="border-t border-divider pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => updateRule(r.id, { active: !r.active })}
              className="text-body-s"
              aria-label="Toggle active"
            >
              {r.active ? "🟢" : "⚪"}
            </button>
            <input
              defaultValue={r.name}
              onBlur={(e) => updateRule(r.id, { name: e.target.value })}
              className="min-w-[180px] flex-1 border border-divider bg-surface px-2 py-1 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <span className="text-caption text-secondary-text">buy</span>
            <input
              type="number"
              defaultValue={r.buy_quantity}
              onBlur={(e) => updateRule(r.id, { buy_quantity: Number(e.target.value) })}
              className="w-16 border border-divider bg-surface px-2 py-1 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <span className="text-caption text-secondary-text">cheapest at</span>
            <input
              type="number"
              defaultValue={r.discount_percent}
              onBlur={(e) => updateRule(r.id, { discount_percent: Number(e.target.value) })}
              className="w-16 border border-divider bg-surface px-2 py-1 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <span className="text-caption text-secondary-text">% off</span>
            <button
              onClick={() => toggleRedemptions(r.id)}
              className="ml-auto text-caption text-secondary-text underline underline-offset-4 hover:text-ink"
            >
              {expandedId === r.id ? "Hide" : "View"} usage
            </button>
            <button
              onClick={() => removeRule(r.id)}
              className="text-caption text-secondary-text transition-colors hover:text-paint-orange"
            >
              Remove
            </button>
          </div>

          {expandedId === r.id && (
            <div className="mt-3 border border-divider bg-surface-alt p-3">
              {loadingRedemptions ? (
                <p className="text-caption text-secondary-text">Loading...</p>
              ) : redemptions.length === 0 ? (
                <p className="text-caption text-secondary-text">Not used on any order yet.</p>
              ) : (
                <>
                  <p className="mb-2 text-caption font-bold text-ink">
                    Used {redemptions.length} time{redemptions.length === 1 ? "" : "s"}
                  </p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-micro uppercase tracking-[0.05em] text-secondary-text">
                        <th className="pb-1 pr-4">Date</th>
                        <th className="pb-1 pr-4">Customer</th>
                        <th className="pb-1">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptions.map((red) => (
                        <tr key={red.id} className="text-caption text-ink">
                          <td className="py-1 pr-4">{formatDate(red.redeemed_at)}</td>
                          <td className="py-1 pr-4">{red.customer_phone || red.customer_email || "—"}</td>
                          <td className="py-1">₹{red.discount_amount.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-divider pt-4">
        <input
          placeholder="New rule name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="min-w-[180px] flex-1 border border-ink/30 bg-surface px-2 py-1 font-sans text-body-s text-ink outline-none focus:border-ink"
        />
        <span className="text-caption text-secondary-text">buy</span>
        <input
          type="number"
          value={draft.buyQuantity}
          onChange={(e) => setDraft((d) => ({ ...d, buyQuantity: Number(e.target.value) }))}
          className="w-16 border border-ink/30 bg-surface px-2 py-1 font-sans text-body-s text-ink outline-none focus:border-ink"
        />
        <span className="text-caption text-secondary-text">cheapest at</span>
        <input
          type="number"
          value={draft.discountPercent}
          onChange={(e) => setDraft((d) => ({ ...d, discountPercent: Number(e.target.value) }))}
          className="w-16 border border-ink/30 bg-surface px-2 py-1 font-sans text-body-s text-ink outline-none focus:border-ink"
        />
        <span className="text-caption text-secondary-text">% off</span>
        <button
          onClick={createRule}
          disabled={creating}
          className="border border-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Add Rule
        </button>
      </div>
    </div>
  );
}
