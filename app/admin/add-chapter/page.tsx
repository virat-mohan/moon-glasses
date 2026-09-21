"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { STYLE_ORDER } from "@/lib/chapters";

const MAX_ANGLES = 3;

const DEFAULT_PRICES: Record<string, { Plastic: number; Metal: number }> = {
  core: { Plastic: 1499, Metal: 1999 },
  limited: { Plastic: 1749, Metal: 2149 },
};

export default function AddChapterPage() {
  const [style, setStyle] = useState<string>(STYLE_ORDER[0]);
  const [rim, setRim] = useState("");
  const [lens, setLens] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [material, setMaterial] = useState<"Plastic" | "Metal">("Plastic");
  const [collection, setCollection] = useState<"core" | "limited">("core");
  const [price, setPrice] = useState(DEFAULT_PRICES.core.Plastic);
  const [priceTouched, setPriceTouched] = useState(false);
  const [stockOnHand, setStockOnHand] = useState(0);

  const [angleImages, setAngleImages] = useState<string[]>([]);
  const [uploadingAngle, setUploadingAngle] = useState<number | null>(null);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [gender, setGender] = useState<"female" | "male">("female");
  const [generating, setGenerating] = useState(false);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ slug: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = useMemo(() => {
    const parts = [rim.trim(), lens.trim()].filter(Boolean).join(" ");
    const withDescriptor = descriptor.trim() ? `${parts} (${descriptor.trim()})` : parts;
    return `${style} — ${withDescriptor}`;
  }, [style, rim, lens, descriptor]);

  const slugPreview = useMemo(() => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }, [name]);

  function applyDefaultPrice(nextCollection: "core" | "limited", nextMaterial: "Plastic" | "Metal") {
    if (!priceTouched) setPrice(DEFAULT_PRICES[nextCollection][nextMaterial]);
  }

  async function uploadOne(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("files", file);
    formData.append("slug", slugPreview || "untitled");
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.urls[0] as string;
  }

  async function handleAngleUpload(index: number, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploadingAngle(index);
    try {
      const url = await uploadOne(file);
      setAngleImages((prev) => {
        const next = [...prev];
        next[index] = url;
        return next.slice(0, MAX_ANGLES);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAngle(null);
    }
  }

  async function handleGenerateModel() {
    const refs = angleImages.filter(Boolean);
    if (refs.length === 0) {
      setError("Upload at least one angle photo first — Gemini needs it as a reference.");
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-model-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrls: refs, gender, productName: name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setModelImage(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate model photo");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const refs = angleImages.filter(Boolean);
    if (refs.length === 0 || !rim.trim() || !lens.trim()) {
      setError("Pick a rim colour, a lens colour, and upload at least one angle photo.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          series: material,
          story: `${style} frame in ${material === "Plastic" ? "acetate" : "metal"}, ${rim.toLowerCase()} ${lens.toLowerCase()} lens tint.`,
          price,
          stockOnHand,
          images: refs,
          primaryImage: refs[0],
          modelImage,
          collection,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({ slug: data.slug, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Product");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-28 pb-24 text-center md:px-12">
        <p className="font-display text-heading-l uppercase text-ink">Product Added.</p>
        <p className="mt-3 text-body-s text-secondary-text">
          <strong>{result.name}</strong> is live at{" "}
          <a href={`/chapter/${result.slug}`} className="underline">
            /chapter/{result.slug}
          </a>{" "}
          — and on {collection === "limited" ? "/limited-series" : "the homepage"}.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Add Another
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[800px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Add A New Product</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Upload 1–3 angle photos, generate a matching model shot with Gemini (or upload your own),
        and it goes live immediately on the homepage or Limited Series — whichever collection you
        pick below.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-8">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Style
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            >
              {STYLE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Material
            </label>
            <select
              value={material}
              onChange={(e) => {
                const next = e.target.value as "Plastic" | "Metal";
                setMaterial(next);
                applyDefaultPrice(collection, next);
              }}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            >
              <option value="Plastic">Plastic (Acetate)</option>
              <option value="Metal">Metal</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Rim Colour
            </label>
            <input
              required
              value={rim}
              onChange={(e) => setRim(e.target.value)}
              placeholder="e.g. Black, Demi-brown, Gunmetal"
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Lens Colour
            </label>
            <input
              required
              value={lens}
              onChange={(e) => setLens(e.target.value)}
              placeholder="e.g. Green, Blue Graded"
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Any Other Descriptor (optional)
          </label>
          <input
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            placeholder='e.g. "Special Edition" — shown in parentheses'
            className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
          <p className="mt-2 text-caption text-secondary-text">
            Name: <strong>{name}</strong> · URL: /chapter/{slugPreview || "…"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Collection
            </label>
            <select
              value={collection}
              onChange={(e) => {
                const next = e.target.value as "core" | "limited";
                setCollection(next);
                applyDefaultPrice(next, material);
              }}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            >
              <option value="core">Core Collection (homepage)</option>
              <option value="limited">Limited Series (/limited-series)</option>
            </select>
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Price (₹)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => {
                setPrice(Number(e.target.value));
                setPriceTouched(true);
              }}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <p className="mt-1 text-caption text-secondary-text">
              Suggested: ₹{DEFAULT_PRICES[collection][material].toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Stock On Hand
          </label>
          <input
            type="number"
            value={stockOnHand}
            onChange={(e) => setStockOnHand(Number(e.target.value))}
            className="mt-3 w-40 border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Angle Photos (1–{MAX_ANGLES}, transparent cutouts)
          </label>
          <div className="mt-3 grid grid-cols-3 gap-4">
            {Array.from({ length: MAX_ANGLES }).map((_, i) => {
              const img = angleImages[i];
              const busy = uploadingAngle === i;
              return (
                <div key={i}>
                  <div className="relative aspect-square overflow-hidden border border-ink/20 bg-surface-alt">
                    {img ? (
                      <Image src={img} alt="" fill sizes="200px" className="object-contain p-2" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-caption text-secondary-text">
                        Empty
                      </div>
                    )}
                    {busy && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-caption text-white">
                        Uploading…
                      </div>
                    )}
                  </div>
                  <label className="mt-2 block cursor-pointer text-center font-sans text-micro uppercase tracking-[0.08em] text-ink underline">
                    {img ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAngleUpload(i, e.target.files?.[0])}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Model / Lifestyle Photo
          </label>
          <div className="mt-3 flex flex-wrap items-start gap-6">
            <div className="w-40">
              <div className="relative aspect-square overflow-hidden border border-ink/20 bg-surface-alt">
                {modelImage ? (
                  <Image src={modelImage} alt="" fill sizes="160px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-caption text-secondary-text">
                    Empty
                  </div>
                )}
                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-caption text-white">
                    Generating…
                  </div>
                )}
              </div>
              {modelImage && (
                <button
                  type="button"
                  onClick={() => setModelImage(null)}
                  className="mt-2 block w-full text-center font-sans text-micro uppercase tracking-[0.08em] text-secondary-text underline"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <p className="text-caption text-secondary-text">
                Uses the uploaded angle photo(s) above as a reference so the model wears the exact
                same frame and lens colour. Saved to /admin/models too, for reuse elsewhere.
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as "female" | "male")}
                  className="border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
                >
                  <option value="female">Female model</option>
                  <option value="male">Male model</option>
                </select>
                <button
                  type="button"
                  onClick={handleGenerateModel}
                  disabled={generating || angleImages.filter(Boolean).length === 0}
                  className="border border-ink px-4 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
                >
                  {generating ? "Generating…" : "Generate With Gemini"}
                </button>
              </div>
              <label className="block cursor-pointer font-sans text-micro uppercase tracking-[0.08em] text-ink underline">
                Or upload your own model photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setModelImage(await uploadOne(file));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Upload failed");
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {error && <p className="text-body-s text-paint-orange">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-50"
        >
          {saving ? "Saving..." : "Publish Product"}
        </button>
      </form>
    </main>
  );
}
