"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Chapter = { slug: string; name: string };
type LineItem = { slug: string; quantity: number };

export default function NewManualOrderPage() {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    paymentType: "prepaid" as "prepaid" | "cod_advance",
    razorpayPaymentId: "",
    manualDiscountRupees: "",
    isGift: false,
    giftNote: "",
  });
  const [items, setItems] = useState<LineItem[]>([{ slug: "", quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/all-chapters")
      .then((res) => res.json())
      .then((data) => setChapters(data.chapters ?? []))
      .catch(() => {});
  }, []);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { slug: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validItems = items.filter((item) => item.slug && item.quantity > 0);
    if (validItems.length === 0) {
      setError("Add at least one item.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          manualDiscountRupees: Number(form.manualDiscountRupees) || 0,
          items: validItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create order");
      setCreatedOrderId(data.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdOrderId) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-28 pb-24 md:px-12">
        <h1 className="font-display text-heading-l uppercase text-ink">Order Created</h1>
        <p className="mt-4 text-body-s text-secondary-text">
          Order #{createdOrderId.slice(0, 8).toUpperCase()} saved — inventory decremented, invoice
          and WhatsApp confirmation sent.
        </p>
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => {
              setCreatedOrderId(null);
              setItems([{ slug: "", quantity: 1 }]);
              setForm((f) => ({ ...f, razorpayPaymentId: "", manualDiscountRupees: "" }));
            }}
            className="border border-ink px-6 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink hover:bg-ink hover:text-cream"
          >
            Add Another
          </button>
          <button
            onClick={() => router.push("/admin/orders")}
            className="text-body-s text-secondary-text underline"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[700px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Add Manual Order</h1>
      <p className="mt-3 max-w-md text-body-s text-secondary-text">
        For a payment or order collected directly outside checkout — prices are still recomputed
        from the catalogue, and inventory/invoice/WhatsApp all fire the same as a normal order.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Customer Name
            </label>
            <input
              required
              value={form.customerName}
              onChange={(e) => updateField("customerName", e.target.value)}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Phone
            </label>
            <input
              required
              type="tel"
              value={form.customerPhone}
              onChange={(e) => updateField("customerPhone", e.target.value)}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Email
          </label>
          <input
            type="email"
            value={form.customerEmail}
            onChange={(e) => updateField("customerEmail", e.target.value)}
            className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Delivery Address
          </label>
          <textarea
            required
            rows={2}
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">City</label>
            <input
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">State</label>
            <input
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">Pincode</label>
            <input
              value={form.pincode}
              onChange={(e) => updateField("pincode", e.target.value)}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
        </div>

        <div className="border-t border-divider pt-6">
          <p className="font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">Items</p>
          <div className="mt-3 space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <select
                  value={item.slug}
                  onChange={(e) => updateItem(i, { slug: e.target.value })}
                  className="flex-1 border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
                >
                  <option value="">Select a Chapter…</option>
                  {chapters.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                  className="w-20 border border-ink/30 bg-surface px-3 py-2.5 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-caption text-paint-orange">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="mt-3 text-caption text-ink underline">
            + Add Item
          </button>
        </div>

        <div className="border-t border-divider pt-6">
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Manual Discount (₹, optional)
          </label>
          <input
            type="number"
            min={0}
            value={form.manualDiscountRupees}
            onChange={(e) => updateField("manualDiscountRupees", e.target.value)}
            placeholder="Stacks on top of the automatic bulk-buy discount"
            className="mt-2 w-full max-w-[240px] border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
        </div>

        <div className="border-t border-divider pt-6">
          <p className="font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">Payment</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                checked={form.paymentType === "prepaid"}
                onChange={() => updateField("paymentType", "prepaid")}
                className="h-4 w-4 accent-ink"
              />
              <span className="font-sans text-body-s text-ink">Prepaid in full</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="radio"
                checked={form.paymentType === "cod_advance"}
                onChange={() => updateField("paymentType", "cod_advance")}
                className="h-4 w-4 accent-ink"
              />
              <span className="font-sans text-body-s text-ink">COD advance</span>
            </label>
          </div>
          <div className="mt-4">
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Payment Reference (optional)
            </label>
            <input
              value={form.razorpayPaymentId}
              onChange={(e) => updateField("razorpayPaymentId", e.target.value)}
              placeholder="Razorpay payment ID, UPI txn ID, etc."
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
            />
          </div>
        </div>

        <div className="border-t border-divider pt-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isGift}
              onChange={(e) => updateField("isGift", e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            <span className="font-sans text-body-s uppercase tracking-[0.05em] text-ink">This is a gift</span>
          </label>
          {form.isGift && (
            <textarea
              rows={2}
              placeholder="Gift note"
              value={form.giftNote}
              onChange={(e) => updateField("giftNote", e.target.value)}
              className="mt-3 w-full border border-ink/30 bg-surface px-4 py-2.5 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
            />
          )}
        </div>

        {error && <p className="text-body-s text-paint-orange">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </form>
    </main>
  );
}
