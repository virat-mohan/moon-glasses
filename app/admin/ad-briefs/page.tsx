"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { chapters } from "@/lib/chapters";

type Brief = {
  id: string;
  chapter_slug: string | null;
  chapter_slugs: string[] | null;
  headline: string;
  primary_text: string;
  cta: string;
  target_audience: string;
  hashtags: string[] | null;
  is_carousel: boolean;
  creative_format: string | null;
  image_prompt: string | null;
  image_prompts: string[] | null;
  creative_style: string | null;
  overlay_text: string | null;
  posted_at: string | null;
  instagram_post_id: string | null;
  image_url: string | null;
  image_urls: (string | null)[] | null;
  image_source: string | null;
  video_status: string | null;
  video_url: string | null;
  status: string;
  meta_campaign_id: string | null;
  created_at: string;
  auto_generated: boolean;
  sales_signal: string | null;
  scheduled_for: string | null;
  scheduled_action: "post" | "launch" | null;
  queue_status: "none" | "queued" | "published" | "failed";
  queue_error: string | null;
  launched_at: string | null;
  ad_cta_override: string | null;
  ad_age_min: number;
  ad_age_max: number;
  ad_gender: "all" | "male" | "female";
  ad_daily_budget_rupees: number;
};

const CTA_OPTIONS = ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER", "CONTACT_US"];

type Asset = { id: string; url: string; label: string | null; tags: string[] };

export default function AdBriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterSlug, setChapterSlug] = useState(chapters[0]?.slug ?? "");
  const [isGeneric, setIsGeneric] = useState(false);
  const [isCarousel, setIsCarousel] = useState(false);
  const [multiChapterMode, setMultiChapterMode] = useState(false);
  const [selectedChapterSlugs, setSelectedChapterSlugs] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  // Per-brief asset selection + format choice for the post-brief "pick
  // assets, then decide static/carousel" step — see creative_format on the
  // Brief type and the stage UI below.
  const [stageAssetUrls, setStageAssetUrls] = useState<Record<string, string[]>>({});
  const [stageFormat, setStageFormat] = useState<Record<string, "static" | "carousel" | "story">>({});
  const [settingFormat, setSettingFormat] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [editInstructions, setEditInstructions] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [videoEditInstructions, setVideoEditInstructions] = useState<Record<string, string>>({});
  const [ctaOverrides, setCtaOverrides] = useState<Record<string, string>>({});
  const [ageMins, setAgeMins] = useState<Record<string, number>>({});
  const [ageMaxs, setAgeMaxs] = useState<Record<string, number>>({});
  const [genders, setGenders] = useState<Record<string, "all" | "male" | "female">>({});
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const [scheduleAction, setScheduleAction] = useState<Record<string, "post" | "launch">>({});
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({});
  const [imageGenerating, setImageGenerating] = useState<Record<string, boolean>>({});
  const [attaching, setAttaching] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editingCopyFor, setEditingCopyFor] = useState<string | null>(null);
  const [copyDraft, setCopyDraft] = useState({ headline: "", primaryText: "", cta: "", targetAudience: "", hashtags: "" });
  const [savingCopy, setSavingCopy] = useState(false);
  const [reviseInstructions, setReviseInstructions] = useState<Record<string, string>>({});
  const [revisingCopy, setRevisingCopy] = useState<Record<string, boolean>>({});
  const [captionTexts, setCaptionTexts] = useState<Record<string, string>>({});
  const [captioning, setCaptioning] = useState<Record<string, boolean>>({});
  const [autoOverlay, setAutoOverlay] = useState<Record<string, boolean>>({});
  const [regenNotes, setRegenNotes] = useState<Record<string, string>>({});
  const [generatingAll, setGeneratingAll] = useState<Record<string, boolean>>({});
  const [tagUsernames, setTagUsernames] = useState<Record<string, string>>({});
  const [postingStory, setPostingStory] = useState<Record<string, boolean>>({});
  const [storyResultById, setStoryResultById] = useState<Record<string, string>>({});
  const [storyLinks, setStoryLinks] = useState<Record<string, string>>({});
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggleStageAsset(briefId: string, url: string) {
    setStageAssetUrls((prev) => {
      const current = prev[briefId] ?? [];
      return { ...prev, [briefId]: current.includes(url) ? current.filter((u) => u !== url) : [...current, url] };
    });
  }

  async function confirmFormat(brief: Brief, format: "static" | "carousel" | "story") {
    setError(null);
    setSettingFormat((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/set-format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, format, assetUrls: stageAssetUrls[brief.id] ?? [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not set format");
      setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, ...data.brief } : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set format");
    } finally {
      setSettingFormat((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  function scrollCarousel(briefId: string, direction: 1 | -1) {
    const el = carouselRefs.current[briefId];
    if (!el) return;
    el.scrollBy({ left: direction * 296, behavior: "smooth" });
  }

  function loadBriefs() {
    fetch("/api/admin/ad-briefs")
      .then((res) => res.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadBriefs, []);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    fetch("/api/admin/marketing-assets")
      .then((res) => res.json())
      .then((data) => setAssets(data.assets ?? []));
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterSlug: isGeneric || (isCarousel && multiChapterMode) ? undefined : chapterSlug,
          chapterSlugs: isCarousel && multiChapterMode ? selectedChapterSlugs : undefined,
          isGeneric: isCarousel && multiChapterMode ? false : isGeneric,
          isCarousel,
          customInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate brief");
      setBriefs((prev) => [data.brief, ...prev]);
      setCustomInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate brief");
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage(brief: Brief) {
    setError(null);
    setImageGenerating((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, imagePrompt: brief.image_prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate image");
      setBriefs((prev) =>
        prev.map((b) => (b.id === brief.id ? { ...b, image_url: data.imageUrl, image_source: "generated" } : b))
      );
      // "Add text overlay" toggle means the caption gets baked in as part of
      // generating, not as a manual second step — the manual "Add Text"
      // button still exists below for changing it afterward.
      if (autoOverlay[brief.id] && captionTexts[brief.id]) {
        await addTextOverlay(brief);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setImageGenerating((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function generateSlotImage(brief: Brief, slotIndex: number, promptOverride?: string) {
    const key = `${brief.id}:${slotIndex}`;
    setError(null);
    setImageGenerating((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          imagePrompt: promptOverride ?? brief.image_prompts?.[slotIndex],
          slotIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate image");
      setBriefs((prev) =>
        prev.map((b) => {
          if (b.id !== brief.id) return b;
          const next = Array.isArray(b.image_urls) ? [...b.image_urls] : [];
          while (next.length < slotIndex + 1) next.push(null);
          next[slotIndex] = data.imageUrl;
          return { ...b, image_urls: next, image_source: "generated" };
        })
      );
      if (autoOverlay[key] && captionTexts[key]) {
        await addTextOverlay(brief, slotIndex);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setImageGenerating((prev) => ({ ...prev, [key]: false }));
    }
  }

  /** Generates every carousel card that doesn't have an image yet, one at a time (not in parallel — each generation already takes a while, and running them sequentially is what makes the per-slot race-safe write actually race-free in practice). */
  async function generateAllSlotImages(brief: Brief) {
    const total = Math.max(brief.image_prompts?.length ?? 0, brief.image_urls?.length ?? 0);
    setGeneratingAll((prev) => ({ ...prev, [brief.id]: true }));
    try {
      for (let i = 0; i < total; i++) {
        if (brief.image_urls?.[i]) continue;
        if (!brief.image_prompts?.[i]) continue;
        await generateSlotImage(brief, i);
      }
    } finally {
      setGeneratingAll((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  /**
   * Regenerates a single carousel card from scratch — the stored prompt plus
   * whatever note the admin typed — instead of image-to-image editing the
   * previous AI output (that's what the separate "Edit instruction" flow
   * does). Going through generateSlotImage means it re-anchors to the real
   * product reference photo every time, so a note like "make the sky more
   * dramatic" can't slowly drift the cap's look away from the actual product
   * the way repeated image-to-image edits would.
   */
  async function regenerateSlotWithNote(brief: Brief, slotIndex: number) {
    const key = `${brief.id}:${slotIndex}`;
    const note = regenNotes[key]?.trim();
    const basePrompt = brief.image_prompts?.[slotIndex] ?? "";
    const prompt = note ? `${basePrompt} ${note}` : basePrompt;
    await generateSlotImage(brief, slotIndex, prompt);
  }

  async function generateVideo(brief: Brief) {
    setError(null);
    setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, video_status: "generating" } : b)));
    try {
      const res = await fetch("/api/admin/ad-briefs/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          imagePrompt: brief.image_prompt,
          editInstruction: videoEditInstructions[brief.id] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start video generation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start video generation");
      setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, video_status: "failed" } : b)));
    }
  }

  async function checkVideoStatus(brief: Brief) {
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-briefs/video-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not check video status");
      if (data.status === "ready") {
        setBriefs((prev) =>
          prev.map((b) => (b.id === brief.id ? { ...b, video_status: "ready", video_url: data.videoUrl } : b))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check video status");
    }
  }

  async function editImage(brief: Brief, slotIndex?: number) {
    const key = slotIndex != null ? `${brief.id}:${slotIndex}` : brief.id;
    const instruction = editInstructions[key];
    if (!instruction) return;
    setError(null);
    setEditing((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, editInstruction: instruction, slotIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not edit image");
      setBriefs((prev) =>
        prev.map((b) => {
          if (b.id !== brief.id) return b;
          if (slotIndex == null) return { ...b, image_url: data.imageUrl, image_source: "generated" };
          const next = Array.isArray(b.image_urls) ? [...b.image_urls] : [];
          while (next.length < slotIndex + 1) next.push(null);
          next[slotIndex] = data.imageUrl;
          return { ...b, image_urls: next, image_source: "generated" };
        })
      );
      setEditInstructions((prev) => ({ ...prev, [key]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit image");
    } finally {
      setEditing((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function addTextOverlay(brief: Brief, slotIndex?: number) {
    const key = slotIndex != null ? `${brief.id}:${slotIndex}` : brief.id;
    const text = captionTexts[key];
    if (!text) return;
    setError(null);
    setCaptioning((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/add-text-overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, text, slotIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add text to image");
      setBriefs((prev) =>
        prev.map((b) => {
          if (b.id !== brief.id) return b;
          if (slotIndex == null) return { ...b, image_url: data.imageUrl, image_source: "with_text_overlay" };
          const next = Array.isArray(b.image_urls) ? [...b.image_urls] : [];
          while (next.length < slotIndex + 1) next.push(null);
          next[slotIndex] = data.imageUrl;
          return { ...b, image_urls: next, image_source: "with_text_overlay" };
        })
      );
      // Deliberately NOT cleared — the field doubles as "what's currently on
      // the image," so it stays editable for a change rather than emptying
      // out, and a toggled-on auto-overlay can reapply it on every regenerate.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add text to image");
    } finally {
      setCaptioning((prev) => ({ ...prev, [key]: false }));
    }
  }

  function startEditCopy(brief: Brief) {
    setEditingCopyFor(brief.id);
    setCopyDraft({
      headline: brief.headline,
      primaryText: brief.primary_text,
      cta: brief.cta,
      targetAudience: brief.target_audience,
      hashtags: (brief.hashtags ?? []).join(", "),
    });
  }

  async function saveCopy(brief: Brief) {
    setError(null);
    setSavingCopy(true);
    try {
      const hashtags = copyDraft.hashtags
        .split(",")
        .map((h) => h.trim().replace(/^#/, ""))
        .filter(Boolean);
      const res = await fetch("/api/admin/ad-briefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          headline: copyDraft.headline,
          primaryText: copyDraft.primaryText,
          cta: copyDraft.cta,
          targetAudience: copyDraft.targetAudience,
          hashtags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save changes");
      }
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id
            ? {
                ...b,
                headline: copyDraft.headline,
                primary_text: copyDraft.primaryText,
                cta: copyDraft.cta,
                target_audience: copyDraft.targetAudience,
                hashtags,
              }
            : b
        )
      );
      setEditingCopyFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSavingCopy(false);
    }
  }

  /** Sends the brief's current copy + a free-text instruction to Claude for a revision (not a from-scratch rewrite) — see reviseAdBriefCopy. */
  async function reviseCopy(brief: Brief) {
    const instruction = reviseInstructions[brief.id]?.trim();
    if (!instruction) return;
    setError(null);
    setRevisingCopy((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/revise-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not revise copy");
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id
            ? {
                ...b,
                headline: data.brief.headline,
                primary_text: data.brief.primary_text,
                cta: data.brief.cta,
                target_audience: data.brief.target_audience,
                hashtags: data.brief.hashtags,
              }
            : b
        )
      );
      setReviseInstructions((prev) => ({ ...prev, [brief.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revise copy");
    } finally {
      setRevisingCopy((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function queueBrief(brief: Brief) {
    const scheduledFor = scheduleAt[brief.id];
    const action = scheduleAction[brief.id] ?? "post";
    if (!scheduledFor) return;
    setError(null);
    setScheduling((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          scheduledFor: new Date(scheduledFor).toISOString(),
          scheduledAction: action,
          dailyBudgetRupees: budgets[brief.id] ?? brief.ad_daily_budget_rupees ?? 500,
          cta: ctaOverrides[brief.id] || undefined,
          ageMin: ageMins[brief.id],
          ageMax: ageMaxs[brief.id],
          gender: genders[brief.id],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not queue brief");
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id
            ? { ...b, scheduled_for: new Date(scheduledFor).toISOString(), scheduled_action: action, queue_status: "queued" }
            : b
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue brief");
    } finally {
      setScheduling((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function cancelQueue(brief: Brief) {
    setError(null);
    try {
      await fetch("/api/admin/ad-briefs/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, cancel: true }),
      });
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id ? { ...b, scheduled_for: null, scheduled_action: null, queue_status: "none" } : b
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel schedule");
    }
  }

  async function attachAsset(brief: Brief, url: string) {
    setError(null);
    setPickerForId(null);
    // The brief itself decided whether this ad wants a real photo with
    // bold on-image text or a plain attached photo — the picker just
    // supplies which real photo to use either way.
    if (brief.creative_style === "real_photo_text_overlay" && brief.overlay_text) {
      setAttaching((prev) => ({ ...prev, [brief.id]: true }));
      try {
        const res = await fetch("/api/admin/ad-briefs/composite-overlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: brief.id, baseImageUrl: url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not composite text overlay");
        setBriefs((prev) =>
          prev.map((b) => (b.id === brief.id ? { ...b, image_url: data.imageUrl, image_source: "real_with_text" } : b))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not composite text overlay");
      } finally {
        setAttaching((prev) => ({ ...prev, [brief.id]: false }));
      }
      return;
    }

    await fetch("/api/admin/ad-briefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: brief.id, imageUrl: url, imageSource: "real" }),
    });
    setBriefs((prev) => prev.map((b) => (b.id === brief.id ? { ...b, image_url: url, image_source: "real" } : b)));
  }

  async function postNow(brief: Brief) {
    setError(null);
    setPosting((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const taggedUsernames = (tagUsernames[brief.id] ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/ad-briefs/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id, taggedUsernames: taggedUsernames.length ? taggedUsernames : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not post to Instagram");
      setBriefs((prev) =>
        prev.map((b) =>
          b.id === brief.id ? { ...b, posted_at: new Date().toISOString(), instagram_post_id: data.postId } : b
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post to Instagram");
    } finally {
      setPosting((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  /** Posts one image (the static brief's image, or one carousel card) to the connected Instagram account's Story feed — independent of the brief's feed-post status, so it can be re-run per card. */
  async function postToStory(briefId: string, slotIndex?: number) {
    const key = slotIndex != null ? `${briefId}:${slotIndex}` : briefId;
    setStoryResultById((prev) => ({ ...prev, [key]: "" }));
    setPostingStory((prev) => ({ ...prev, [key]: true }));
    try {
      const linkUrl = storyLinks[key]?.trim() || undefined;
      const res = await fetch("/api/admin/ad-briefs/post-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: briefId, slotIndex, linkUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not post to Story");
      setStoryResultById((prev) => ({ ...prev, [key]: "Posted to Story" }));
    } catch (err) {
      setStoryResultById((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Could not post to Story",
      }));
    } finally {
      setPostingStory((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function launch(brief: Brief) {
    setError(null);
    setLaunching((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brief.id,
          dailyBudgetRupees: budgets[brief.id] ?? 500,
          cta: ctaOverrides[brief.id] || undefined,
          ageMin: ageMins[brief.id],
          ageMax: ageMaxs[brief.id],
          gender: genders[brief.id],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not launch campaign");
      setBriefs((prev) =>
        prev.map((b) => (b.id === brief.id ? { ...b, status: "launched", meta_campaign_id: data.campaignId } : b))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch campaign");
    } finally {
      setLaunching((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  async function deleteBrief(brief: Brief) {
    if (!confirm("Delete this draft? This can't be undone — it won't cancel an already-launched Meta campaign.")) {
      return;
    }
    setError(null);
    setBriefs((prev) => prev.filter((b) => b.id !== brief.id));
    try {
      const res = await fetch(`/api/admin/ad-briefs?id=${brief.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete draft");
      loadBriefs();
    }
  }

  const [duplicating, setDuplicating] = useState<Record<string, boolean>>({});

  async function duplicateBrief(brief: Brief) {
    setError(null);
    setDuplicating((prev) => ({ ...prev, [brief.id]: true }));
    try {
      const res = await fetch("/api/admin/ad-briefs/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brief.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not duplicate brief");
      setBriefs((prev) => [data.brief, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate brief");
    } finally {
      setDuplicating((prev) => ({ ...prev, [brief.id]: false }));
    }
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Ad Brief Generator</h1>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Claude drafts ad copy from recent sales, you attach a real photo or generate one, then
        launch — every campaign is created PAUSED on Meta. Nothing goes live until you switch it
        on yourself in Meta Ads Manager.
      </p>

      <div className="mt-8 border-t border-divider pt-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsGeneric(false)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              !isGeneric ? "border-ink bg-ink text-cream" : "border-divider text-ink"
            }`}
          >
            Specific Chapter
          </button>
          <button
            type="button"
            onClick={() => setIsGeneric(true)}
            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
              isGeneric ? "border-ink bg-ink text-cream" : "border-divider text-ink"
            }`}
          >
            Generic Brand Post
          </button>
        </div>

        {!isGeneric && (
          <label className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={multiChapterMode}
              onChange={(e) => {
                setMultiChapterMode(e.target.checked);
                setIsCarousel(e.target.checked);
              }}
              className="h-4 w-4 accent-ink"
            />
            <span className="font-sans text-body-s text-ink">
              Multi-Product Carousel (one card per Chapter)
            </span>
          </label>
        )}
        {!isGeneric && !multiChapterMode && (
          <p className="mt-1 text-micro text-secondary-text/70">
            For a single Chapter, pick Static vs. Carousel after the brief is written — see below.
          </p>
        )}

        {isGeneric ? (
          <p className="mt-3 text-micro text-secondary-text/70">
            Not tied to one product — the copy covers the brand as a whole, and the CTA links to
            the homepage instead of a Chapter page.
          </p>
        ) : multiChapterMode ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
                Chapters ({selectedChapterSlugs.length} selected)
              </label>
              <button
                type="button"
                onClick={() =>
                  setSelectedChapterSlugs(
                    selectedChapterSlugs.length === chapters.length ? [] : chapters.map((c) => c.slug)
                  )
                }
                className="text-micro text-secondary-text underline"
              >
                {selectedChapterSlugs.length === chapters.length ? "Clear All" : "Select All"}
              </button>
            </div>
            <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto border border-divider p-2 md:grid-cols-3">
              {chapters.map((c) => (
                <label key={c.slug} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChapterSlugs.includes(c.slug)}
                    onChange={(e) =>
                      setSelectedChapterSlugs((prev) =>
                        e.target.checked ? [...prev, c.slug] : prev.filter((s) => s !== c.slug)
                      )
                    }
                    className="h-3.5 w-3.5 accent-ink"
                  />
                  <span className="text-body-s text-ink">{c.name}</span>
                </label>
              ))}
            </div>
            {selectedChapterSlugs.length > 0 && selectedChapterSlugs.length < 2 && (
              <p className="mt-1 text-micro text-paint-orange">Pick at least 2 chapters for a carousel.</p>
            )}
          </>
        ) : (
          <>
            <label className="mt-4 block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Chapter
            </label>
            <select
              value={chapterSlug}
              onChange={(e) => setChapterSlug(e.target.value)}
              className="mt-3 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            >
              {chapters.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mt-4 block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
          Custom Direction (optional)
        </label>
        <p className="mt-1 text-micro text-secondary-text/70">
          Override the default strategy — e.g. &ldquo;focus on the monsoon angle&rdquo; or
          &ldquo;target gifting, not the wearer directly.&rdquo;
        </p>
        <textarea
          rows={2}
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
        />

        <button
          onClick={generate}
          disabled={generating || (isCarousel && multiChapterMode && selectedChapterSlugs.length < 2)}
          className="mt-4 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Ad Brief"}
        </button>
        {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}
      </div>

      <div className="mt-12 space-y-10">
        {loading ? (
          <p className="text-body-s text-secondary-text">Loading...</p>
        ) : briefs.length === 0 ? (
          <p className="text-body-s text-secondary-text">No briefs yet.</p>
        ) : (
          briefs.map((brief) => (
            <div key={brief.id} className="border-t border-divider pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
                  {brief.chapter_slugs && brief.chapter_slugs.length > 0
                    ? brief.chapter_slugs
                        .map((s) => chapters.find((c) => c.slug === s)?.name ?? s)
                        .join(" · ")
                    : brief.chapter_slug
                      ? (chapters.find((c) => c.slug === brief.chapter_slug)?.name ?? brief.chapter_slug)
                      : "Generic — Brand"}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">
                    {brief.status}
                  </span>
                  <button
                    onClick={() => duplicateBrief(brief)}
                    disabled={duplicating[brief.id]}
                    className="text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-ink disabled:opacity-40"
                  >
                    {duplicating[brief.id] ? "Duplicating..." : "Duplicate"}
                  </button>
                  <button
                    onClick={() => deleteBrief(brief)}
                    className="text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-paint-orange"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-[280px_1fr]">
                <div>
                  {!brief.creative_format &&
                  !brief.image_url &&
                  !(brief.image_urls ?? []).some(Boolean) &&
                  !brief.is_carousel ? (
                    <div className="w-[280px]">
                      <p className="mb-2 text-micro uppercase tracking-[0.1em] text-secondary-text">
                        1. Pick a format
                      </p>
                      <div className="flex gap-2">
                        {(["static", "carousel", "story"] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setStageFormat((prev) => ({ ...prev, [brief.id]: f }))}
                            className={`border px-3 py-1.5 text-caption uppercase tracking-[0.05em] ${
                              (stageFormat[brief.id] ?? "static") === f
                                ? "border-ink bg-ink text-cream"
                                : "border-divider text-ink"
                            }`}
                          >
                            {f === "static" ? "Static" : f === "carousel" ? "Carousel" : "Story"}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const format = stageFormat[brief.id] ?? "static";
                        const pickedCount = (stageAssetUrls[brief.id] ?? []).length;
                        return (
                          <>
                            <p className="mb-2 mt-4 text-micro uppercase tracking-[0.1em] text-secondary-text">
                              2. Pick photos (optional)
                            </p>
                            {assets.length === 0 ? (
                              <p className="text-micro text-secondary-text/70">
                                No assets uploaded yet — see Marketing Assets. You can still generate with AI below.
                              </p>
                            ) : (
                              <div className="grid grid-cols-5 gap-1.5">
                                {assets.map((a) => {
                                  const selected = (stageAssetUrls[brief.id] ?? []).includes(a.url);
                                  return (
                                    <button
                                      key={a.id}
                                      type="button"
                                      onClick={() => toggleStageAsset(brief.id, a.url)}
                                      className={`relative aspect-square overflow-hidden border-2 ${
                                        selected ? "border-ink" : "border-transparent"
                                      }`}
                                      title={a.label ?? undefined}
                                    >
                                      <Image src={a.url} alt={a.label ?? "Asset"} fill className="object-cover" />
                                      {selected && (
                                        <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-cream">
                                          ✓
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {pickedCount > 0 && (
                              <p className="mt-1.5 text-micro text-secondary-text">
                                {pickedCount} selected —{" "}
                                <button
                                  type="button"
                                  onClick={() => setStageAssetUrls((prev) => ({ ...prev, [brief.id]: [] }))}
                                  className="underline"
                                >
                                  Clear
                                </button>
                              </p>
                            )}
                            <p className="mt-1.5 text-micro text-secondary-text/70">
                              {format === "carousel"
                                ? pickedCount >= 2
                                  ? "2+ photos picked — a Carousel uses each as its own card."
                                  : "Pick 2+ photos for a Carousel, or leave empty to generate fresh AI cards."
                                : pickedCount >= 1
                                  ? `One photo picked — ${format === "story" ? "Story" : "Static"} uses it directly (only the first if you picked more).`
                                  : `No photos picked — ${format === "story" ? "Story" : "Static"} will generate a fresh AI image.`}
                            </p>
                            <button
                              onClick={() => confirmFormat(brief, format)}
                              disabled={settingFormat[brief.id]}
                              className="mt-3 block w-full border border-ink bg-ink px-3 py-1.5 text-micro font-bold uppercase tracking-[0.05em] text-cream disabled:opacity-50"
                            >
                              {settingFormat[brief.id] ? "Confirming..." : "Confirm & Continue"}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ) : brief.is_carousel ? (
                    <div className="w-[280px]">
                      <button
                        onClick={() => generateAllSlotImages(brief)}
                        disabled={generatingAll[brief.id]}
                        className="mb-2 block w-full border border-ink px-2 py-1.5 text-micro font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
                      >
                        {generatingAll[brief.id] ? "Generating All..." : "Generate All Missing Cards"}
                      </button>
                      <div className="relative">
                        <div
                          ref={(el) => {
                            carouselRefs.current[brief.id] = el;
                          }}
                          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
                        {Array.from(
                          { length: Math.max(brief.image_prompts?.length ?? 0, brief.image_urls?.length ?? 0) },
                          (_, i) => i
                        ).map((i) => {
                          const url = brief.image_urls?.[i];
                          const slotKey = `${brief.id}:${i}`;
                          return (
                            <div key={i} className="w-[280px] shrink-0 snap-center">
                              <p className="mb-1 text-micro uppercase tracking-[0.05em] text-secondary-text">
                                Card {i + 1} of {Math.max(brief.image_prompts?.length ?? 0, brief.image_urls?.length ?? 0)}
                              </p>
                              {url ? (
                                <button
                                  type="button"
                                  onClick={() => setLightboxUrl(url)}
                                  className="relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-surface-alt"
                                >
                                  <Image src={url} alt={`${brief.headline} — card ${i + 1}`} fill sizes="280px" className="object-cover" />
                                </button>
                              ) : (
                                <div className="flex aspect-square items-center justify-center bg-surface-alt text-micro text-secondary-text">
                                  {imageGenerating[slotKey] ? "Generating..." : `Card ${i + 1}`}
                                </div>
                              )}
                              <button
                                onClick={() => generateSlotImage(brief, i)}
                                disabled={!brief.image_prompts?.[i] || imageGenerating[slotKey]}
                                className="mt-1.5 block w-full border border-ink px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-40"
                              >
                                {imageGenerating[slotKey] ? "Generating..." : url ? "Regenerate" : "Generate"}
                              </button>
                              <div className="mt-1.5 flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Note, e.g. &quot;more sunlight&quot; — from scratch"
                                  value={regenNotes[slotKey] ?? ""}
                                  onChange={(e) => setRegenNotes((prev) => ({ ...prev, [slotKey]: e.target.value }))}
                                  className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                                />
                                <button
                                  onClick={() => regenerateSlotWithNote(brief, i)}
                                  disabled={!brief.image_prompts?.[i] || imageGenerating[slotKey]}
                                  className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase text-ink hover:border-ink disabled:opacity-40"
                                >
                                  {imageGenerating[slotKey] ? "..." : "Regenerate"}
                                </button>
                              </div>
                              {url && (
                                <div className="mt-1.5 flex gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="Tweak current image, e.g. &quot;remove sunglasses&quot;"
                                    value={editInstructions[`${brief.id}:${i}`] ?? ""}
                                    onChange={(e) =>
                                      setEditInstructions((prev) => ({ ...prev, [`${brief.id}:${i}`]: e.target.value }))
                                    }
                                    className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                                  />
                                  <button
                                    onClick={() => editImage(brief, i)}
                                    disabled={!editInstructions[`${brief.id}:${i}`] || editing[`${brief.id}:${i}`]}
                                    className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase text-ink hover:border-ink disabled:opacity-40"
                                  >
                                    {editing[`${brief.id}:${i}`] ? "..." : "Confirm"}
                                  </button>
                                </div>
                              )}
                              <div className="mt-1.5 flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Text on image"
                                  value={captionTexts[slotKey] ?? ""}
                                  onChange={(e) => setCaptionTexts((prev) => ({ ...prev, [slotKey]: e.target.value }))}
                                  className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                                />
                                {url && (
                                  <button
                                    onClick={() => addTextOverlay(brief, i)}
                                    disabled={!captionTexts[slotKey] || captioning[slotKey]}
                                    className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase text-ink hover:border-ink disabled:opacity-40"
                                  >
                                    {captioning[slotKey] ? "..." : "Apply"}
                                  </button>
                                )}
                              </div>
                              <label className="mt-1 flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={autoOverlay[slotKey] ?? false}
                                  onChange={(e) => setAutoOverlay((prev) => ({ ...prev, [slotKey]: e.target.checked }))}
                                  className="h-3 w-3 accent-ink"
                                />
                                <span className="text-micro text-secondary-text">Auto-add on generate</span>
                              </label>
                              {url && (
                                <div className="mt-1.5">
                                  <input
                                    type="text"
                                    placeholder={`Story link (defaults to /chapter/${brief.chapter_slugs?.[i] ?? "..."})`}
                                    value={storyLinks[slotKey] ?? ""}
                                    onChange={(e) => setStoryLinks((prev) => ({ ...prev, [slotKey]: e.target.value }))}
                                    className="mb-1.5 block w-full border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                                  />
                                  <button
                                    onClick={() => postToStory(brief.id, i)}
                                    disabled={postingStory[slotKey]}
                                    className="block w-full border border-divider px-2 py-1.5 text-micro uppercase text-ink hover:border-ink disabled:opacity-40"
                                  >
                                    {postingStory[slotKey] ? "Posting..." : "Post To Story"}
                                  </button>
                                  {storyResultById[slotKey] && (
                                    <p className="mt-1 text-micro text-secondary-text">{storyResultById[slotKey]}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                        <button
                          type="button"
                          onClick={() => scrollCarousel(brief.id, -1)}
                          aria-label="Previous card"
                          className="absolute left-1.5 top-[160px] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-cream hover:bg-ink"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollCarousel(brief.id, 1)}
                          aria-label="Next card"
                          className="absolute right-1.5 top-[160px] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-cream hover:bg-ink"
                        >
                          ›
                        </button>
                      </div>
                      <p className="mt-1 text-micro text-secondary-text/70">← Scroll to see all cards →</p>
                    </div>
                  ) : (
                    <>
                      {brief.image_url ? (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(brief.image_url)}
                          className="relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-surface-alt"
                        >
                          <Image src={brief.image_url} alt={brief.headline} fill sizes="280px" className="object-cover" />
                        </button>
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-surface-alt text-micro text-secondary-text">
                          No image yet
                        </div>
                      )}
                      <p className="mt-2 text-micro text-secondary-text/70">
                        {brief.creative_style === "real_photo_text_overlay"
                          ? `Recommended: real photo + "${brief.overlay_text}" overlay`
                          : "Recommended: AI-generated lifestyle photo"}
                      </p>
                      {attaching[brief.id] && (
                        <p className="mt-2 text-micro uppercase tracking-[0.05em] text-tan-gold">
                          Compositing text overlay onto photo...
                        </p>
                      )}
                      <div className="mt-2 space-y-1.5">
                        <button
                          onClick={() => generateImage(brief)}
                          disabled={imageGenerating[brief.id]}
                          className={`block w-full border px-2 py-1.5 text-micro uppercase tracking-[0.05em] hover:bg-ink hover:text-cream disabled:opacity-40 ${
                            brief.creative_style === "real_photo_text_overlay"
                              ? "border-divider text-ink hover:border-ink"
                              : "border-ink text-ink"
                          }`}
                        >
                          {imageGenerating[brief.id] ? "Generating..." : brief.image_url ? "Regenerate" : "Generate With AI"}
                        </button>
                        <button
                          onClick={() => setPickerForId(pickerForId === brief.id ? null : brief.id)}
                          disabled={attaching[brief.id]}
                          className={`block w-full border px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink disabled:opacity-40 ${
                            brief.creative_style === "real_photo_text_overlay" ? "border-ink" : "border-divider hover:border-ink"
                          }`}
                        >
                          {brief.creative_style === "real_photo_text_overlay" ? "Use Real Photo (+ Text)" : "Use Real Photo"}
                        </button>
                        {brief.image_url && (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Edit instruction — e.g. &quot;make the sky more orange&quot;"
                              value={editInstructions[brief.id] ?? ""}
                              onChange={(e) => setEditInstructions((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                              className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                            />
                            <button
                              onClick={() => editImage(brief)}
                              disabled={!editInstructions[brief.id] || editing[brief.id]}
                              className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                            >
                              {editing[brief.id] ? "Regenerating..." : "Confirm"}
                            </button>
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Text on image — e.g. &quot;NEW DROP&quot;"
                            value={captionTexts[brief.id] ?? ""}
                            onChange={(e) => setCaptionTexts((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                            className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                          />
                          {brief.image_url && (
                            <button
                              onClick={() => addTextOverlay(brief)}
                              disabled={!captionTexts[brief.id] || captioning[brief.id]}
                              className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                            >
                              {captioning[brief.id] ? "Adding..." : "Apply"}
                            </button>
                          )}
                        </div>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={autoOverlay[brief.id] ?? false}
                            onChange={(e) => setAutoOverlay((prev) => ({ ...prev, [brief.id]: e.target.checked }))}
                            className="h-3 w-3 accent-ink"
                          />
                          <span className="text-micro text-secondary-text">Auto-add text when generating</span>
                        </label>
                      </div>
                      {pickerForId === brief.id && (
                        <div className="mt-2 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto border border-divider p-2">
                          {assets.map((a) => (
                            <button key={a.id} onClick={() => attachAsset(brief, a.url)} className="relative aspect-square">
                              <Image src={a.url} alt={a.label ?? ""} fill sizes="80px" className="object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-4 border-t border-divider pt-3">
                    <p className="mb-1.5 text-micro uppercase tracking-[0.05em] text-secondary-text">
                      Reel (Veo)
                    </p>
                    {brief.video_status === "ready" && brief.video_url ? (
                      <video src={brief.video_url} controls className="w-full bg-surface-alt" />
                    ) : null}
                    {brief.video_status === "generating" ? (
                      <button
                        onClick={() => checkVideoStatus(brief)}
                        className="mt-2 block w-full border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
                      >
                        Check Status
                      </button>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Edit direction (optional) — e.g. &quot;slower pan, closer on the cap&quot;"
                          value={videoEditInstructions[brief.id] ?? ""}
                          onChange={(e) =>
                            setVideoEditInstructions((prev) => ({ ...prev, [brief.id]: e.target.value }))
                          }
                          className="mt-2 w-full border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                        />
                        <button
                          onClick={() => generateVideo(brief)}
                          disabled={!brief.image_prompt}
                          className="mt-1.5 block w-full border border-ink px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
                        >
                          {brief.video_status === "ready"
                            ? "Regenerate Reel"
                            : brief.video_status === "failed"
                              ? "Retry Generation"
                              : "Generate Reel"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  {brief.auto_generated && (
                    <span className="mb-2 inline-block border border-tan-gold px-2 py-1 text-micro uppercase tracking-[0.05em] text-tan-gold">
                      Auto-drafted — {brief.sales_signal === "selling_fast" ? "Selling Fast" : "Cooling Off"}
                    </span>
                  )}
                  {editingCopyFor === brief.id ? (
                    <div className="space-y-2">
                      <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">Headline</label>
                      <input
                        type="text"
                        value={copyDraft.headline}
                        onChange={(e) => setCopyDraft((prev) => ({ ...prev, headline: e.target.value }))}
                        className="w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                      />
                      <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">Primary Text</label>
                      <textarea
                        rows={3}
                        value={copyDraft.primaryText}
                        onChange={(e) => setCopyDraft((prev) => ({ ...prev, primaryText: e.target.value }))}
                        className="w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                      />
                      <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">CTA</label>
                      <input
                        type="text"
                        value={copyDraft.cta}
                        onChange={(e) => setCopyDraft((prev) => ({ ...prev, cta: e.target.value }))}
                        className="w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                      />
                      <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">Audience</label>
                      <input
                        type="text"
                        value={copyDraft.targetAudience}
                        onChange={(e) => setCopyDraft((prev) => ({ ...prev, targetAudience: e.target.value }))}
                        className="w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                      />
                      <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
                        Hashtags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={copyDraft.hashtags}
                        onChange={(e) => setCopyDraft((prev) => ({ ...prev, hashtags: e.target.value }))}
                        className="w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveCopy(brief)}
                          disabled={savingCopy}
                          className="border border-ink bg-ink px-3 py-1.5 text-micro uppercase tracking-[0.05em] text-cream disabled:opacity-40"
                        >
                          {savingCopy ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingCopyFor(null)}
                          disabled={savingCopy}
                          className="border border-divider px-3 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-display text-heading-s uppercase text-ink">{brief.headline}</h2>
                        <button
                          onClick={() => startEditCopy(brief)}
                          className="shrink-0 text-micro uppercase tracking-[0.05em] text-secondary-text underline hover:text-ink"
                        >
                          Edit Copy
                        </button>
                      </div>
                      <p className="mt-2 text-body-s text-ink">{brief.primary_text}</p>
                      <p className="mt-3 text-caption text-secondary-text">CTA: {brief.cta}</p>
                      <p className="mt-1 text-caption text-secondary-text">
                        Audience: {brief.target_audience}
                      </p>
                      {brief.hashtags && brief.hashtags.length > 0 && (
                        <p className="mt-2 text-caption text-secondary-text">
                          {brief.hashtags.map((h) => `#${h}`).join(" ")}
                        </p>
                      )}
                      <div className="mt-2 flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Revise copy with AI — e.g. &quot;make it punchier&quot;"
                          value={reviseInstructions[brief.id] ?? ""}
                          onChange={(e) => setReviseInstructions((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                          className="w-full min-w-0 border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                        />
                        <button
                          onClick={() => reviseCopy(brief)}
                          disabled={!reviseInstructions[brief.id]?.trim() || revisingCopy[brief.id]}
                          className="shrink-0 border border-divider px-2 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                        >
                          {revisingCopy[brief.id] ? "..." : "Revise"}
                        </button>
                      </div>
                    </>
                  )}

                  <div className="mt-4">
                    {(() => {
                      const feedBlock = brief.posted_at ? (
                        <p className="text-caption text-tan-gold">
                          Posted to Instagram — {new Date(brief.posted_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      ) : (
                        <>
                          <input
                            type="text"
                            placeholder="Tag @username(s), comma-separated (optional)"
                            value={tagUsernames[brief.id] ?? ""}
                            onChange={(e) => setTagUsernames((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                            className="mb-2 block w-full max-w-xs border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                          />
                          <button
                            onClick={() => postNow(brief)}
                            disabled={
                              posting[brief.id] ||
                              (brief.is_carousel
                                ? (brief.image_urls ?? []).filter(Boolean).length <
                                  Math.max(brief.image_prompts?.length ?? 0, 2)
                                : !brief.image_url)
                            }
                            className="border border-divider px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                          >
                            {posting[brief.id] ? "Posting..." : "Post Now (No Ad Spend)"}
                          </button>
                        </>
                      );

                      const storyBlock = !brief.is_carousel && (
                        <div className={brief.creative_format === "story" ? "" : "mt-2"}>
                          <input
                            type="text"
                            placeholder={`Story link (defaults to /chapter/${brief.chapter_slug ?? "..."})`}
                            value={storyLinks[brief.id] ?? ""}
                            onChange={(e) => setStoryLinks((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                            className="mb-2 block w-full max-w-xs border border-divider bg-surface px-2 py-1.5 text-micro text-ink"
                          />
                          <button
                            onClick={() => postToStory(brief.id)}
                            disabled={postingStory[brief.id] || !brief.image_url}
                            className="border border-divider px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                          >
                            {postingStory[brief.id] ? "Posting..." : "Post To Story"}
                          </button>
                          {storyResultById[brief.id] && (
                            <p className="mt-1 text-micro text-secondary-text">{storyResultById[brief.id]}</p>
                          )}
                        </div>
                      );

                      // A Story-format brief leads with "Post To Story" — the
                      // feed-post option (with its own ad-spend-free caveat)
                      // still exists underneath for the rare case someone
                      // wants both.
                      return brief.creative_format === "story" ? (
                        <>
                          {storyBlock}
                          <div className="mt-2">{feedBlock}</div>
                        </>
                      ) : (
                        <>
                          {feedBlock}
                          {storyBlock}
                        </>
                      );
                    })()}
                  </div>

                  {brief.status !== "launched" && (
                    <div className="mt-4 border-t border-divider pt-3">
                      <p className="mb-2 text-micro uppercase tracking-[0.05em] text-secondary-text">
                        Ad Launch Attributes
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">Daily budget ₹</span>
                          <input
                            type="number"
                            defaultValue={brief.ad_daily_budget_rupees ?? 500}
                            onChange={(e) => setBudgets((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))}
                            className="w-full border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">CTA button</span>
                          <select
                            defaultValue={brief.ad_cta_override || brief.cta}
                            onChange={(e) => setCtaOverrides((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                            className="w-full border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                          >
                            {CTA_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">Age range</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              defaultValue={brief.ad_age_min ?? 18}
                              onChange={(e) => setAgeMins((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))}
                              className="w-full min-w-0 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            />
                            <span className="text-secondary-text">–</span>
                            <input
                              type="number"
                              defaultValue={brief.ad_age_max ?? 65}
                              onChange={(e) => setAgeMaxs((prev) => ({ ...prev, [brief.id]: Number(e.target.value) }))}
                              className="w-full min-w-0 border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            />
                          </div>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-micro text-secondary-text">Gender</span>
                          <select
                            defaultValue={brief.ad_gender ?? "all"}
                            onChange={(e) =>
                              setGenders((prev) => ({ ...prev, [brief.id]: e.target.value as "all" | "male" | "female" }))
                            }
                            className="w-full border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                          >
                            <option value="all">All</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </label>
                      </div>
                      <p className="mt-1.5 text-micro text-secondary-text/70">
                        Objective: Traffic (link clicks) · Placements: Automatic · Country: India — fixed for now.
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          onClick={() => launch(brief)}
                          disabled={
                            launching[brief.id] ||
                            (brief.is_carousel
                              ? (brief.image_urls ?? []).filter(Boolean).length <
                                Math.max(brief.image_prompts?.length ?? 0, 2)
                              : !brief.image_url)
                          }
                          className="border border-ink bg-ink px-4 py-1.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream disabled:opacity-40"
                        >
                          {launching[brief.id] ? "Launching..." : "Launch Now (Paused)"}
                        </button>
                      </div>

                      <div className="mt-4 border-t border-divider pt-3">
                        <p className="mb-1.5 text-micro uppercase tracking-[0.05em] text-secondary-text">
                          Queue For Later
                        </p>
                        {brief.queue_status === "queued" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-caption text-tan-gold">
                              Queued to {brief.scheduled_action === "launch" ? "launch" : "post"} —{" "}
                              {brief.scheduled_for &&
                                new Date(brief.scheduled_for).toLocaleString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  day: "numeric",
                                  month: "short",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                            </p>
                            <button
                              onClick={() => cancelQueue(brief)}
                              className="text-micro text-secondary-text underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="datetime-local"
                              value={scheduleAt[brief.id] ?? ""}
                              onChange={(e) => setScheduleAt((prev) => ({ ...prev, [brief.id]: e.target.value }))}
                              className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            />
                            <select
                              value={scheduleAction[brief.id] ?? "post"}
                              onChange={(e) =>
                                setScheduleAction((prev) => ({ ...prev, [brief.id]: e.target.value as "post" | "launch" }))
                              }
                              className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                            >
                              <option value="post">Post To Instagram</option>
                              <option value="launch">Launch Ad (Paused)</option>
                            </select>
                            <button
                              onClick={() => queueBrief(brief)}
                              disabled={!scheduleAt[brief.id] || scheduling[brief.id]}
                              className="border border-divider px-3 py-1.5 text-micro uppercase tracking-[0.05em] text-ink hover:border-ink disabled:opacity-40"
                            >
                              {scheduling[brief.id] ? "Queuing..." : "Queue"}
                            </button>
                            {brief.queue_status === "failed" && (
                              <p className="w-full text-micro text-paint-orange">
                                Last attempt failed: {brief.queue_error}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {brief.status === "launched" && (
                    <p className="mt-4 text-caption text-tan-gold">
                      Created on Meta as PAUSED — campaign {brief.meta_campaign_id}. Open Meta Ads
                      Manager to review and activate.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-6"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-6 top-6 border border-cream/40 px-3 py-1.5 text-caption uppercase tracking-[0.05em] text-cream hover:border-cream"
          >
            Close ✕
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}
