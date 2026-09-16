"use client";

import { useState } from "react";

export function InventoryRow({
  chapterSlug,
  chapterName,
  stockOnHand,
}: {
  chapterSlug: string;
  chapterName: string;
  stockOnHand: number;
}) {
  const [value, setValue] = useState(stockOnHand);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterSlug, stockOnHand: value }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-divider">
      <td className="py-3 font-sans text-body-s text-ink">{chapterName}</td>
      <td className="py-3">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            setValue(Math.max(0, Number(e.target.value) || 0));
            setSaved(false);
          }}
          className="w-24 border border-divider bg-surface px-2 py-1 font-sans text-body-s text-ink"
        />
      </td>
      <td className="py-3">
        <button
          onClick={save}
          disabled={saving || value === stockOnHand}
          className="border border-ink px-4 py-1.5 text-caption uppercase tracking-[0.05em] text-ink disabled:opacity-30"
        >
          {saved ? "Saved" : saving ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}
