"use client";

import { Fragment, useEffect, useState } from "react";

type Coupon = {
  id: string;
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  expires_at: string | null;
  usage_limit: number | null;
  times_used: number;
  active: boolean;
  created_at: string;
};

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

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    code: "",
    discountType: "flat" as "flat" | "percent",
    discountValue: "",
    expiresAt: "",
    usageLimit: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadCoupons() {
    fetch("/api/admin/coupons")
      .then((res) => res.json())
      .then((data) => setCoupons(data.coupons ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadCoupons, []);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discountType,
          discountValue: Number(discountValue),
          expiresAt: expiresAt || null,
          usageLimit: usageLimit || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create coupon");
      setCode("");
      setDiscountValue("");
      setExpiresAt("");
      setUsageLimit("");
      loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create coupon");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c)));
    await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coupon.active }),
    });
  }

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setEditDraft({
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      expiresAt: coupon.expires_at ? coupon.expires_at.slice(0, 10) : "",
      usageLimit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editDraft.code,
          discountType: editDraft.discountType,
          discountValue: Number(editDraft.discountValue),
          expiresAt: editDraft.expiresAt || null,
          usageLimit: editDraft.usageLimit || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save changes");
      setEditingId(null);
      loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Delete coupon ${coupon.code}? This can't be undone.`)) return;
    setDeletingId(coupon.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete coupon");
      }
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete coupon");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleRedemptions(couponId: string) {
    if (expandedId === couponId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(couponId);
    setLoadingRedemptions(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`);
      const data = await res.json();
      setRedemptions(data.redemptions ?? []);
    } finally {
      setLoadingRedemptions(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Coupon Codes</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Time-limited or shareable discount codes, separate from referral codes — entered at
        checkout, with every redemption tracked below.
      </p>

      <form onSubmit={createCoupon} className="mt-8 flex flex-wrap items-end gap-4 border-t border-divider pt-6">
        <div>
          <label className="block text-caption text-secondary-text">Code</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            className="mt-1 w-36 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "flat" | "percent")}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          >
            <option value="flat">Flat ₹</option>
            <option value="percent">Percent %</option>
          </select>
        </div>
        <div>
          <label className="block text-caption text-secondary-text">
            Value {discountType === "percent" ? "(%)" : "(₹)"}
          </label>
          <input
            required
            type="number"
            min={1}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="mt-1 w-24 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Expires (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Usage limit (optional)</label>
          <input
            type="number"
            min={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Unlimited"
            className="mt-1 w-28 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="border border-ink bg-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Coupon"}
        </button>
      </form>
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Code</th>
              <th className="py-2 pr-4">Discount</th>
              <th className="py-2 pr-4">Expires</th>
              <th className="py-2 pr-4">Used</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4"></th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-body-s text-secondary-text">
                  No coupons yet.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <Fragment key={c.id}>
                  {editingId === c.id ? (
                    <tr className="border-b border-divider bg-surface-alt/40">
                      <td className="py-3 pr-4">
                        <input
                          value={editDraft.code}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          className="w-32 border border-divider bg-surface px-2 py-1 font-sans text-body-s text-ink"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={editDraft.discountType}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, discountType: e.target.value as "flat" | "percent" }))
                            }
                            className="border border-divider bg-surface px-1.5 py-1 font-sans text-caption text-ink"
                          >
                            <option value="flat">₹</option>
                            <option value="percent">%</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={editDraft.discountValue}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, discountValue: e.target.value }))}
                            className="w-16 border border-divider bg-surface px-2 py-1 font-sans text-body-s text-ink"
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="date"
                          value={editDraft.expiresAt}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, expiresAt: e.target.value }))}
                          className="border border-divider bg-surface px-2 py-1 font-sans text-caption text-ink"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={1}
                          placeholder="Unlimited"
                          value={editDraft.usageLimit}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, usageLimit: e.target.value }))}
                          className="w-20 border border-divider bg-surface px-2 py-1 font-sans text-caption text-ink"
                        />
                      </td>
                      <td className="py-3" colSpan={2}>
                        <button
                          onClick={() => toggleActive(c)}
                          className={`text-micro uppercase tracking-[0.05em] ${c.active ? "text-tan-gold" : "text-secondary-text"}`}
                        >
                          {c.active ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(c.id)}
                            disabled={saving}
                            className="border border-ink bg-ink px-3 py-1 text-micro uppercase tracking-[0.05em] text-cream disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                            className="border border-divider px-3 py-1 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-divider">
                      <td className="py-3 font-sans text-body-s text-ink">{c.code}</td>
                      <td className="py-3 text-caption text-secondary-text">
                        {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                      </td>
                      <td className="py-3 text-caption text-secondary-text">
                        {c.expires_at ? formatDate(c.expires_at) : "Never"}
                      </td>
                      <td className="py-3 text-caption text-secondary-text">
                        {c.times_used}
                        {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => toggleActive(c)}
                          className={`text-micro uppercase tracking-[0.05em] ${c.active ? "text-tan-gold" : "text-secondary-text"}`}
                        >
                          {c.active ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => toggleRedemptions(c.id)}
                          className="text-micro text-secondary-text underline"
                        >
                          {expandedId === c.id ? "Hide" : "View"} redemptions
                        </button>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCoupon(c)}
                            disabled={deletingId === c.id}
                            className="text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-paint-orange disabled:opacity-50"
                          >
                            {deletingId === c.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={7} className="bg-surface-alt/40 px-4 py-4">
                        {loadingRedemptions ? (
                          <p className="text-caption text-secondary-text">Loading...</p>
                        ) : redemptions.length === 0 ? (
                          <p className="text-caption text-secondary-text">No redemptions yet.</p>
                        ) : (
                          <table className="w-full max-w-lg text-left">
                            <thead>
                              <tr className="text-micro uppercase tracking-[0.05em] text-secondary-text">
                                <th className="pb-1 pr-4">When</th>
                                <th className="pb-1 pr-4">Phone</th>
                                <th className="pb-1 pr-4">Email</th>
                                <th className="pb-1 pr-4">Discount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {redemptions.map((r) => (
                                <tr key={r.id}>
                                  <td className="py-1 pr-4 text-caption text-secondary-text">
                                    {formatDate(r.redeemed_at)}
                                  </td>
                                  <td className="py-1 pr-4 text-caption text-ink">{r.customer_phone ?? "—"}</td>
                                  <td className="py-1 pr-4 text-caption text-ink">{r.customer_email ?? "—"}</td>
                                  <td className="py-1 pr-4 text-caption text-ink">₹{r.discount_amount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
