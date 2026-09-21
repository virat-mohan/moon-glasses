"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Row = {
  slug: string;
  name: string;
  series: string;
  primary: string;
  modelImage?: string;
  price: number;
  collection: "core" | "limited";
  live: boolean;
};

function StatusPill({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-micro font-bold uppercase tracking-[0.05em] ${
        live ? "bg-tan-gold text-black" : "border border-divider text-secondary-text"
      }`}
    >
      {live ? "Live" : "Draft"}
    </span>
  );
}

export default function MasterInventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "live" | "draft">("all");

  function load() {
    fetch("/api/admin/master-inventory")
      .then((res) => res.json())
      .then((data) => setRows(data.chapters ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function patch(slug: string, body: Record<string, unknown>) {
    setBusySlug(slug);
    setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, ...body } : r)));
    try {
      await fetch("/api/admin/master-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...body }),
      });
    } finally {
      setBusySlug(null);
    }
  }

  async function generateModel(row: Row) {
    setBusySlug(row.slug);
    try {
      const res = await fetch("/api/admin/generate-model-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrls: [row.primary], gender: "female", productName: row.name, chapterSlug: row.slug }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await patch(row.slug, { modelImage: data.url });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate model photo");
    } finally {
      setBusySlug(null);
    }
  }

  const filtered = rows.filter((r) => (filter === "all" ? true : filter === "live" ? r.live : !r.live));

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Master Inventory</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Every supplier-sourced product you've imported, whether or not it's shown on the site.
        Toggle <strong>Live</strong> to publish/unpublish, pick which collection it belongs to, and
        generate a model photo — all without touching code. Products stay here as drafts for as
        long as you like before you decide to show them.
      </p>

      <div className="mt-6 flex gap-2">
        {(["all", "live", "draft"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`border px-4 py-1.5 font-sans text-caption uppercase tracking-[0.05em] ${
              filter === f ? "border-ink bg-ink text-cream" : "border-divider text-secondary-text hover:border-ink hover:text-ink"
            }`}
          >
            {f} {f !== "all" && `(${rows.filter((r) => (f === "live" ? r.live : !r.live)).length})`}
          </button>
        ))}
        <Link
          href="/admin/add-chapter"
          className="ml-auto border border-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors hover:bg-ink hover:text-cream"
        >
          + Add Product
        </Link>
      </div>

      {loading ? (
        <p className="mt-10 text-body-s text-secondary-text">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-body-s text-secondary-text">Nothing here yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {filtered.map((row) => (
            <div key={row.slug} className="flex flex-wrap items-center gap-4 border-t border-divider pt-4">
              <div className="relative h-20 w-20 flex-none overflow-hidden bg-white">
                <Image src={row.primary} alt={row.name} fill sizes="80px" className="object-contain p-1.5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-body-s text-ink">{row.name}</p>
                <p className="text-caption text-secondary-text">
                  {row.series} · ₹{row.price.toLocaleString("en-IN")}
                </p>
                <div className="mt-1">
                  <StatusPill live={row.live} />
                </div>
              </div>

              <div className="relative h-20 w-20 flex-none overflow-hidden bg-[var(--moon-black)]">
                {row.modelImage ? (
                  <Image src={row.modelImage} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-micro text-secondary-text">
                    No model photo
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => generateModel(row)}
                disabled={busySlug === row.slug}
                className="flex-none border border-ink px-3 py-1.5 font-sans text-caption text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
              >
                {busySlug === row.slug ? "…" : row.modelImage ? "Regenerate" : "Generate"} Model
              </button>

              <select
                value={row.collection}
                onChange={(e) => patch(row.slug, { collection: e.target.value })}
                className="flex-none border border-ink/30 bg-surface px-3 py-1.5 font-sans text-caption text-ink"
              >
                <option value="core">Core Collection</option>
                <option value="limited">Limited Series</option>
              </select>

              <button
                type="button"
                onClick={() => patch(row.slug, { live: !row.live })}
                className={`flex-none border px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] transition-colors ${
                  row.live
                    ? "border-divider text-secondary-text hover:border-ink hover:text-ink"
                    : "border-ink bg-ink text-cream hover:bg-cream hover:text-ink"
                }`}
              >
                {row.live ? "Unpublish" : "Publish"}
              </button>

              {row.live && (
                <Link
                  href={`/chapter/${row.slug}`}
                  className="flex-none text-caption text-secondary-text underline underline-offset-4 hover:text-ink"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
