"use client";

import { useState } from "react";

const REASON_OPTIONS = [
  { value: "defect", label: "Defective / Damaged" },
  { value: "wrong_size", label: "Wrong Size" },
];

export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const [reason, setReason] = useState("defect");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("orderId", orderId);
      formData.set("reason", reason);
      formData.set("note", note);
      if (photo) formData.set("photo", photo);

      const res = await fetch("/api/returns", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not submit your return request");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your return request");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="text-body-s text-ink">
        Request submitted — we&apos;ll review it and email you about next steps.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
        >
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Tell us more
        </label>
        <textarea
          required
          rows={4}
          placeholder="What's wrong, or which size you expected"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
        />
      </div>

      <div>
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Photo (optional, helps for defects)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="mt-3 w-full font-sans text-body-s text-ink"
        />
      </div>

      {error && <p className="text-body-s text-paint-orange">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Return Request"}
      </button>
    </form>
  );
}
