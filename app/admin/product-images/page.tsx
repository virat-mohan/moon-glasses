"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type ChapterOption = { slug: string; name: string };

const MAX_ANGLES = 3;

export default function ProductImagesPage() {
  const [chapterOptions, setChapterOptions] = useState<ChapterOption[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [angleImages, setAngleImages] = useState<string[]>([]);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/all-chapters")
      .then((res) => res.json())
      .then((data) => {
        setChapterOptions(data.chapters ?? []);
        if (data.chapters?.[0]) setSlug(data.chapters[0].slug);
      });
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setSaved(false);
    setError(null);
    fetch(`/api/admin/product-images?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        setAngleImages(data.angleImages ?? []);
        setModelImage(data.modelImage ?? null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function uploadOne(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("files", file);
    formData.append("slug", slug ?? "untitled");
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.urls[0] as string;
  }

  async function handleAngleUpload(index: number, file: File | undefined) {
    if (!file || !slug) return;
    setError(null);
    setUploading(`angle-${index}`);
    try {
      const url = await uploadOne(file);
      setAngleImages((prev) => {
        const next = [...prev];
        next[index] = url;
        return next.slice(0, MAX_ANGLES);
      });
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function handleModelUpload(file: File | undefined) {
    if (!file || !slug) return;
    setError(null);
    setUploading("model");
    try {
      const url = await uploadOne(file);
      setModelImage(url);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  function removeAngle(index: number) {
    setAngleImages((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave() {
    if (!slug) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/hero-override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterSlug: slug,
          images: angleImages,
          modelImage,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[800px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Product Images</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Up to {MAX_ANGLES} product angle shots plus one model/lifestyle shot per product. Angles
        show in the product page gallery; the model shot is what the homepage tile flips to on
        hover.
      </p>

      <div className="mt-8">
        <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Product
        </label>
        <select
          value={slug ?? ""}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-3 w-full border border-ink/30 bg-surface px-5 py-3 font-sans text-body-s text-ink outline-none focus:border-ink"
        >
          {chapterOptions.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-10 text-body-s text-secondary-text">Loading…</p>
      ) : (
        <>
          <div className="mt-10">
            <p className="font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Angle Photos ({angleImages.length}/{MAX_ANGLES})
            </p>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {Array.from({ length: MAX_ANGLES }).map((_, i) => {
                const img = angleImages[i];
                const busy = uploading === `angle-${i}`;
                return (
                  <div key={i} className="relative">
                    <div className="relative aspect-square overflow-hidden border border-ink/20 bg-surface-alt">
                      {img ? (
                        <Image src={img} alt="" fill sizes="200px" className="object-cover" />
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
                    {img && (
                      <button
                        type="button"
                        onClick={() => removeAngle(i)}
                        className="mt-1 block w-full text-center font-sans text-micro uppercase tracking-[0.08em] text-secondary-text underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <p className="font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Model / Lifestyle Photo
            </p>
            <div className="mt-3 w-40">
              <div className="relative aspect-square overflow-hidden border border-ink/20 bg-surface-alt">
                {modelImage ? (
                  <Image src={modelImage} alt="" fill sizes="200px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-caption text-secondary-text">
                    Empty
                  </div>
                )}
                {uploading === "model" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-caption text-white">
                    Uploading…
                  </div>
                )}
              </div>
              <label className="mt-2 block cursor-pointer text-center font-sans text-micro uppercase tracking-[0.08em] text-ink underline">
                {modelImage ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleModelUpload(e.target.files?.[0])}
                />
              </label>
              {modelImage && (
                <button
                  type="button"
                  onClick={() => setModelImage(null)}
                  className="mt-1 block w-full text-center font-sans text-micro uppercase tracking-[0.08em] text-secondary-text underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {error && <p className="mt-6 text-body-s text-paint-orange">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-10 w-full border border-ink bg-ink px-8 py-4 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Product Card"}
          </button>
        </>
      )}
    </main>
  );
}
