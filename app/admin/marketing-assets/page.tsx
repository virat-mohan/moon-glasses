"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Asset = { id: string; url: string; label: string | null; tags: string[]; created_at: string };

export default function MarketingAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  function load() {
    fetch("/api/admin/marketing-assets")
      .then((res) => res.json())
      .then((data) => setAssets(data.assets ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function seed() {
    setSeeding(true);
    try {
      await fetch("/api/admin/marketing-assets/seed", { method: "POST" });
      load();
    } finally {
      setSeeding(false);
    }
  }

  const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel serverless functions cap request bodies around 4.5MB

  async function upload() {
    if (!uploadFiles || uploadFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const files = Array.from(uploadFiles);
    setUploadProgress({ done: 0, total: files.length });
    const failures: string[] = [];
    try {
      // One file per request, sequentially — a single multipart request with
      // every file at once easily exceeds Vercel's ~4.5MB request-body limit
      // for a real batch of photos, and that failure was previously
      // completely silent (no error check on the response at all).
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          failures.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB — over the 4MB limit)`);
          setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
          continue;
        }
        const formData = new FormData();
        formData.append("files", file);
        formData.append("label", uploadLabel);
        formData.append("tags", uploadTags);
        try {
          const res = await fetch("/api/admin/marketing-assets", { method: "POST", body: formData });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            failures.push(`${file.name} (${data?.error ?? `HTTP ${res.status}`})`);
          }
        } catch {
          failures.push(`${file.name} (network error)`);
        }
        setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
      }
      if (failures.length > 0) {
        setUploadError(`Failed to upload: ${failures.join(", ")}`);
      }
      setUploadLabel("");
      setUploadTags("");
      setUploadFiles(null);
      load();
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function remove(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    await fetch("/api/admin/marketing-assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    assets.forEach((a) => a.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [assets]);

  const filtered = activeTag ? assets.filter((a) => a.tags.includes(activeTag)) : assets;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Marketing Assets</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Real photography for ad creatives — product shots, lifestyle, logos, people wearing the
        caps. Ad briefs can use these directly instead of generating a new image, or feed one in as
        a reference for image-gen compositing.
      </p>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={seed}
          disabled={seeding}
          className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {seeding ? "Importing..." : "Import Existing Photos"}
        </button>
        <p className="text-caption text-secondary-text">
          Pulls in everything already in the brand/lifestyle/community/chapter folders, tagged by
          category.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-divider pt-6">
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Upload Photos
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setUploadFiles(e.target.files)}
            className="mt-1 text-body-s text-ink file:mr-3 file:border file:border-ink file:bg-transparent file:px-3 file:py-1.5 file:font-sans file:text-caption file:font-bold file:uppercase file:tracking-[0.05em] file:text-ink"
          />
        </div>
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Label (optional)
          </label>
          <input
            type="text"
            value={uploadLabel}
            onChange={(e) => setUploadLabel(e.target.value)}
            placeholder="e.g. Diwali shoot"
            className="mt-1 w-40 border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={uploadTags}
            onChange={(e) => setUploadTags(e.target.value)}
            placeholder="e.g. lifestyle, festive"
            className="mt-1 w-48 border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
          />
        </div>
        <button
          onClick={upload}
          disabled={uploading || !uploadFiles || uploadFiles.length === 0}
          className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {uploading
            ? uploadProgress
              ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
              : "Uploading..."
            : "Upload"}
        </button>
      </div>
      {uploadError && <p className="mt-3 max-w-2xl text-body-s text-paint-orange">{uploadError}</p>}

      {allTags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`border px-3 py-1 text-caption uppercase tracking-[0.05em] ${
              activeTag === null ? "border-ink bg-ink text-cream" : "border-divider text-ink"
            }`}
          >
            All ({assets.length})
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`border px-3 py-1 text-caption uppercase tracking-[0.05em] ${
                activeTag === tag ? "border-ink bg-ink text-cream" : "border-divider text-ink"
              }`}
            >
              {tag} ({assets.filter((a) => a.tags.includes(tag)).length})
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-5">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-body-s text-secondary-text">No assets yet.</p>
        ) : (
          filtered.map((asset) => (
            <div key={asset.id} className="group relative">
              <div className="relative aspect-square overflow-hidden bg-surface-alt">
                <Image src={asset.url} alt={asset.label ?? ""} fill sizes="200px" className="object-cover" />
              </div>
              <p className="mt-1 truncate text-micro uppercase tracking-[0.03em] text-secondary-text">
                {asset.label}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {asset.tags.map((t) => (
                  <span key={t} className="text-micro text-secondary-text/70">
                    #{t}
                  </span>
                ))}
              </div>
              <button
                onClick={() => remove(asset.id)}
                className="absolute right-1 top-1 hidden bg-black/60 px-1.5 py-0.5 text-micro text-white group-hover:block"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
