"use client";

import { useEffect, useState } from "react";

type BrandProfile = {
  brandName: string;
  tagline: string;
  voice: string;
  productNoun: string;
  currencySymbol: string;
  siteUrl: string;
  instagramHandle: string;
};

const FIELDS: { key: keyof BrandProfile; label: string; hint: string; multiline?: boolean }[] = [
  { key: "brandName", label: "Brand Name", hint: "" },
  { key: "tagline", label: "Tagline", hint: "" },
  {
    key: "voice",
    label: "Brand Voice",
    hint: "Drives every Claude prompt — journal drafts and ad briefs both read this.",
    multiline: true,
  },
  { key: "productNoun", label: "Product Noun", hint: "e.g. \"trucker cap\" — swap this to repoint the whole pipeline at a different product." },
  { key: "currencySymbol", label: "Currency Symbol", hint: "" },
  { key: "siteUrl", label: "Site URL", hint: "Used as the base for ad landing links." },
  { key: "instagramHandle", label: "Instagram Handle", hint: "" },
];

export default function BrandProfilePage() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/brand-profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.profile))
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof BrandProfile, value: string) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!profile) return;
    await fetch("/api/admin/brand-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaved(true);
  }

  return (
    <main className="mx-auto w-full max-w-[700px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Brand Profile</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        The single source of truth every marketing/content generator reads from — journal drafts,
        ad briefs, image prompts. Change this instead of the code to repoint the whole pipeline at
        a different brand or product line later.
      </p>

      {loading || !profile ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading...</p>
      ) : (
        <div className="mt-10 space-y-6">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                {f.label}
              </label>
              {f.hint && <p className="mt-1 text-micro text-secondary-text/70">{f.hint}</p>}
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={profile[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              ) : (
                <input
                  value={profile[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                />
              )}
            </div>
          ))}

          <button
            onClick={save}
            className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      )}
    </main>
  );
}
