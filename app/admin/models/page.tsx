"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Asset = { id: string; url: string; label: string | null; tags: string[]; created_at: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ModelsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/marketing-assets")
      .then((res) => res.json())
      .then((data) => setAssets((data.assets ?? []).filter((a: Asset) => a.tags.includes("generated-model"))))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function remove(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    await fetch("/api/admin/marketing-assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const filtered = genderFilter ? assets.filter((a) => a.tags.includes(genderFilter)) : assets;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Models</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Every model photo generated via Gemini from /admin/add-chapter or /admin/product-images
        lands here automatically — reuse these for social posts, ad creatives, or anywhere else,
        whether or not they ended up attached to a product page.
      </p>

      <div className="mt-6 flex gap-2">
        {["male", "female"].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGenderFilter(genderFilter === g ? null : g)}
            className={`border px-4 py-1.5 font-sans text-caption uppercase tracking-[0.05em] ${
              genderFilter === g ? "border-ink bg-ink text-cream" : "border-divider text-secondary-text hover:border-ink hover:text-ink"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 text-body-s text-secondary-text">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-body-s text-secondary-text">
          No generated model photos yet — create a product with the Gemini generator to see them
          here.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((a) => (
            <div key={a.id}>
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                <Image src={a.url} alt={a.label ?? ""} fill sizes="240px" className="object-cover" />
              </div>
              <p className="mt-2 text-caption text-ink">{a.label}</p>
              <p className="text-micro text-secondary-text">{formatDate(a.created_at)}</p>
              <div className="mt-1 flex gap-3">
                <a
                  href={a.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="text-micro uppercase tracking-[0.05em] text-ink underline"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="text-micro uppercase tracking-[0.05em] text-secondary-text underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
