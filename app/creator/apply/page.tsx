"use client";

import { useState } from "react";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

const CATEGORIES = ["Fashion", "Lifestyle", "Beauty", "Travel", "Fitness", "Other"];

type FormState = {
  name: string;
  email: string;
  phone: string;
  instagramHandle: string;
  category: string;
  city: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  instagramHandle: "",
  category: "",
  city: "",
};

const inputClass =
  "border border-white/25 bg-transparent px-4 py-3 font-sans text-body-s text-white placeholder:text-secondary-text focus:border-white focus:outline-none";

export default function CreatorApplyPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || !form.instagramHandle.trim()) {
      setError("Enter your name, a valid email, and your Instagram handle");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/creators/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit your application");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your application");
      setStatus("idle");
    }
  }

  return (
    <>
      <main className="mx-auto flex min-h-[70vh] w-full max-w-[600px] flex-col items-center px-6 pt-32 pb-24 text-center md:pt-40">
        <p className="font-sans text-micro uppercase tracking-[0.3em] text-secondary-text">
          Become a Creator
        </p>
        <h1 className="mt-4 font-sans text-heading-xl text-white">Join the Community</h1>
        <p className="mt-4 max-w-md font-sans text-body-s text-secondary-text">
          Discover new products, create content you actually want to share, and get access to
          exclusive creator drops. Takes one minute.
        </p>

        {status === "done" ? (
          <div className="mt-12 border border-white/25 px-8 py-10">
            <p className="font-sans text-body text-white">Application received.</p>
            <p className="mt-2 font-sans text-body-s text-secondary-text">
              We review every application by hand — if it&rsquo;s a fit, we&rsquo;ll reach out by
              email or WhatsApp with next steps.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-12 flex w-full flex-col gap-4 text-left">
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Instagram handle (e.g. @yourname)"
              value={form.instagramHandle}
              onChange={(e) => update("instagramHandle", e.target.value)}
              className={inputClass}
            />
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className={`${inputClass} text-secondary-text`}
            >
              <option value="">Content category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-black text-white">
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="City (optional)"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className={inputClass}
            />

            {error && <p className="font-sans text-caption text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-2 py-4 font-sans text-body-s uppercase tracking-[0.15em] text-white transition-colors duration-200 hover:text-[var(--moon-gold)] disabled:opacity-60"
            >
              {status === "submitting" ? "Submitting…" : "Apply"}
            </button>
          </form>
        )}
      </main>
      <FooterEditorial />
    </>
  );
}
