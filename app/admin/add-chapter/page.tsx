"use client";

import { useState } from "react";
import Image from "next/image";
import { seriesOrder } from "@/lib/series";

type UploadedImage = { url: string; file: string };

export default function AddChapterPage() {
  const [name, setName] = useState("");
  const [series, setSeries] = useState(seriesOrder[0].name);
  const [price, setPrice] = useState(1399);
  const [stockOnHand, setStockOnHand] = useState(0);
  const [story, setStory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function slugPreview() {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (!name.trim()) {
      setError("Enter a Chapter name first — image uploads are filed under it.");
      return;
    }
    setError(null);
    setUploading(true);

    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("files", f));
    formData.append("slug", slugPreview() || "untitled");

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newImages: UploadedImage[] = data.urls.map((url: string, i: number) => ({
        url,
        file: Array.from(fileList)[i].name,
      }));
      setImages((prev) => {
        const combined = [...prev, ...newImages];
        if (!primaryUrl && combined[0]) setPrimaryUrl(combined[0].url);
        return combined;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (images.length === 0 || !primaryUrl) {
      setError("Upload at least one image and pick a hero shot.");
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
          series,
          story,
          price,
          stockOnHand,
          images: images.map((i) => i.url),
          primaryImage: primaryUrl,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Chapter");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-28 pb-24 text-center md:px-12">
        <p className="font-display text-heading-l uppercase text-ink">Chapter Added.</p>
        <p className="mt-3 text-body-s text-secondary-text">
          <strong>{name}</strong> is live at{" "}
          <a href={`/chapter/${result.slug}`} className="underline">
            /chapter/{result.slug}
          </a>
          .
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
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Add A New Chapter</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Images upload straight to cloud storage, so this works the same in production as it does
        here. It'll show up on the homepage, its Series page, and get its own /chapter/&lt;slug&gt;
        page immediately.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Chapter Name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
          {name && (
            <p className="mt-1 text-caption text-secondary-text">
              URL: /chapter/{slugPreview()}
            </p>
          )}
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Series
          </label>
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value as typeof series)}
            className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
          >
            {seriesOrder.map((s) => (
              <option key={s.slug} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Price (INR)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Stock On Hand
            </label>
            <input
              type="number"
              value={stockOnHand}
              onChange={(e) => setStockOnHand(Number(e.target.value))}
              className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Story (founder-voice description)
          </label>
          <textarea
            required
            rows={4}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
            Photos
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="mt-3 block font-sans text-body-s text-ink"
          />
          {uploading && <p className="mt-2 text-caption text-secondary-text">Uploading...</p>}

          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {images.map((img) => (
                <button
                  type="button"
                  key={img.url}
                  onClick={() => setPrimaryUrl(img.url)}
                  className="block text-left"
                >
                  <div
                    className={`relative aspect-square overflow-hidden bg-surface-alt ${
                      primaryUrl === img.url ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <Image src={img.url} alt="" fill sizes="150px" className="object-cover" />
                  </div>
                  <p className="mt-1 text-micro uppercase text-secondary-text">
                    {primaryUrl === img.url ? "Hero ✓" : "Set as hero"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-body-s text-paint-orange">{error}</p>}

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-50"
        >
          {saving ? "Saving..." : "Publish Chapter"}
        </button>
      </form>
    </main>
  );
}
