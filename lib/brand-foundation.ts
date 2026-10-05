/**
 * Moonglasses — structured Brand Foundation (the machine-readable authority).
 *
 * The CONTRACT + lifecycle come from the shared package @retail-os/brand-config
 * (brand-foundation); this file holds only Moonglasses' VALUES, DERIVED from the
 * existing in-repo authority `lib/brand-voice.ts` (BRAND_VOICE) and the human
 * brand book case-study/brands/moonglasses.md — nothing is invented.
 *
 * Authority hierarchy (BRAND-BOOK-STANDARD + the Retail OS technology decision):
 *   Human Brand Book  →  Structured Brand Foundation (@retail-os/brand-config)  →  runtime consumers
 * `brand-voice.ts` is a CONSUMER/ADAPTER of this Foundation, not a competing
 * authority. Do NOT create another structured Brand Foundation source — this is
 * the same @retail-os/brand-config architecture Travaholic uses, not a Moon fork.
 *
 * Downstream gate: automated brand communication may be driven ONLY by a
 * COMMITTED Foundation (isDownstreamAllowed). `brandVoicePrompt()` enforces it
 * via getMoonVoiceModel().
 *
 * Built lazily (memoized) so there is no module-init cycle with brand-voice.ts.
 */
import {
  defineBrandFoundation,
  transitionFoundation,
  isDownstreamAllowed,
  type BrandFoundation,
} from "@retail-os/brand-config/brand-foundation";
import { BRAND_VOICE } from "./brand-voice.ts";

/** Genuine unresolved / explicitly-held items (recorded, not auto-committed). */
export const RECONCILIATION_ITEMS: string[] = [
  "Weekly Friday mix is not live yet (Virat, 2 Oct 2026): the mix/playlist lines stay excluded until it launches.",
  "Support WhatsApp number is the SUPPORT_WHATSAPP runtime setting, never a committed value — prompts never state a number.",
  "Pay With A Post™ numbers live in lib/pwap-rules.ts and are never committed here.",
];

let _committed: BrandFoundation | null = null;

/** Build the committed Moonglasses Foundation from the existing approved sources. Memoized. */
export function getMoonFoundation(): BrandFoundation {
  if (_committed) return _committed;
  const v = BRAND_VOICE;
  const p = v.facts.prices;

  const draft = defineBrandFoundation({
    key: "moonglasses",
    identity: {
      name: v.brand,
      legalName: undefined,
      tagline: v.tagline,
      positioning: "Fashion eyewear for after dark; light tints, good vibe. Two founders.",
      valueProposition: v.oneLineVibe,
    },
    // No fixed ICP in the brand book; grounded in the Meta default targeting
    // (lib/meta-ads.ts: age 18–65, all genders) + per-product targetAudience.
    icp: { audience: "Fashion-eyewear buyers in India; Meta default 18–65, all genders, with per-campaign targeting set per product.", geography: "India" },
    voice: {
      attributes: [...v.attributes],
      do: [...v.do],
      dont: [...v.dont],
      bannedWords: [...v.supplierModelNames, "Ted Smith"],
      retiredNames: [...v.facts.staleTaglines, ...v.facts.stale],
    },
    visual: {
      colors: [
        { name: "black", hex: v.colours.black },
        { name: "ink", hex: v.colours.ink },
        { name: "white", hex: v.colours.white },
        { name: "paper", hex: v.colours.paper },
        { name: "muted", hex: v.colours.muted },
        { name: "line", hex: v.colours.line },
        { name: "gold", hex: v.colours.gold },
        { name: "goldSoft", hex: v.colours.goldSoft },
        { name: "goldSecondary", hex: v.colours.goldSecondary },
        { name: "text", hex: v.colours.text },
        { name: "lensBlue", hex: v.colours.lensBlue },
        { name: "lensPink", hex: v.colours.lensPink },
        { name: "lensGreen", hex: v.colours.lensGreen },
        { name: "lensPeach", hex: v.colours.lensPeach },
      ],
      fonts: [v.fonts.primary, v.fonts.secondary, v.fonts.editorialItalic],
      logoUsage: v.logo,
      photoStyle: v.photoStyle,
    },
    contentPillars: ["A late-night listening room that happens to sell glasses", "Ritual over urgency: a periodic drop, never scarcity"],
    channelHouseStyle: {
      social: { hashtags: [...v.hashtags], captionLength: `post ${v.captionMax.post} / reel ${v.captionMax.reel}` },
      email: { signOff: v.emailSignOff },
      ad: { cta: v.adCtaDefault },
    },
    approvedClaims: [
      `Collection ₹${p.collectionPlastic.toLocaleString("en-IN")} plastic / ₹${p.collectionMetal.toLocaleString("en-IN")} metal (GST incl.)`,
      `Limited Series ₹${p.limitedPlastic.toLocaleString("en-IN")} plastic / ₹${p.limitedMetal.toLocaleString("en-IN")} metal (GST incl.)`,
      v.facts.shipping,
      "Pay With A Post™ (rules/numbers from lib/pwap-rules.ts, never hardcoded)",
    ],
    restrictions: [
      "No wallet imperatives (shop, buy, grab yours, deal); buttons are labels, not commands.",
      "No fake urgency; ritual over urgency.",
      "Never name the supplier (Ted Smith) or supplier model names in customer copy, except the credit line 'Moonglasses × Ted Smith' on product pages.",
      "Never promise a weekly/Friday mix until it is live.",
      "Never state a WhatsApp number or Pay With A Post™ figures in copy.",
      "Never mention Gift First, follower thresholds or 'we ship first'.",
    ],
    founderContext: "Partner brand, co-owned 50/50 by Anun Dhawan and Virat. Two founders; 'we' is the two of them.",
    // The exact prose/marketing values brandVoicePrompt() interpolates that are not
    // first-class Foundation fields. Held here so the committed Foundation — not
    // brand-voice.ts — is the source. All DERIVED from BRAND_VOICE; nothing invented.
    marketingPreferences: {
      promptModel: {
        siteUrl: v.siteUrl,
        instagramHandle: v.instagramHandle,
        oneLineVibe: v.oneLineVibe,
        northStarTest: v.northStarTest,
        posture: v.posture,
        easiestWay: v.easiestWay,
        sliders: v.sliders.map((s) => ({ slider: s.slider, lean: s.lean, avoid: s.avoid })),
        foundingPrinciple: v.foundingPrinciple,
        keywords: {
          core: [...v.keywords.core],
          mood: [...v.keywords.mood],
          sound: [...v.keywords.sound],
          belonging: [...v.keywords.belonging],
        },
        maxMoodWordsPerPiece: v.maxMoodWordsPerPiece,
        labels: Object.fromEntries(Object.entries(v.labels).map(([k, alts]) => [k, [...alts]])),
        sampleCopy: {
          heroHeadlines: [...v.sampleCopy.heroHeadlines],
          heroSubline: v.sampleCopy.heroSubline,
          footer: v.sampleCopy.footer,
        },
        prices: { collectionPlastic: p.collectionPlastic, collectionMetal: p.collectionMetal, limitedPlastic: p.limitedPlastic, limitedMetal: p.limitedMetal },
        shipping: v.facts.shipping,
        ownModelNames: [...v.ownModelNames],
        supplierModelNames: [...v.supplierModelNames],
        logoName: v.logoName,
        heroCta: v.heroCta,
        captionMax: { post: v.captionMax.post, reel: v.captionMax.reel },
        emailSignOff: v.emailSignOff,
        adCtaDefault: v.adCtaDefault,
      },
    },
    enabledModules: [],
    communicationRules: {
      escalateWhen: [
        "anything the brand book does not cover — ask Virat/Anun, never guess",
        "commercial, legal or materially consequential matters",
      ],
    },
    currentFacts: [
      { label: "shipping", value: v.facts.shipping },
      { label: "tagline", value: v.tagline, staleValues: [...v.facts.staleTaglines] },
      { label: "weeklyMix", value: "Not live yet", staleValues: ["new mix every Friday", "weekly mix"] },
    ],
    sources: [
      { label: "lib/brand-voice.ts (checkVoice module)", date: "2026-10-02", confidence: "founder_approved" },
      { label: "lib/retail-os-brand.ts", date: "2026-10-02", confidence: "from_website" },
      { label: "Supabase brands row 'moonglasses'", date: "2026-10-02", confidence: "from_website" },
      { label: "Virat — brand answers (name, gold, tagline, fonts, CTAs, hashtags)", date: "2026-10-02", confidence: "founder_approved" },
    ],
    gaps: [], // required fields resolved; open items live in brand-voice OPEN_QUESTIONS + RECONCILIATION_ITEMS
  });

  const reviewed = transitionFoundation(draft, "review");
  const approved = transitionFoundation(reviewed, "approved", { approvedBy: "Virat Mohan (brand answers, 2 Oct 2026)" });
  _committed = transitionFoundation(approved, "committed");
  return _committed;
}

/** Returns the committed Foundation, or throws — the hard gate for downstream brand output. */
export function requireCommittedFoundation(): BrandFoundation {
  const f = getMoonFoundation();
  if (!isDownstreamAllowed(f)) {
    throw new Error("Moonglasses Brand Foundation is not COMMITTED; brand output is blocked until it is.");
  }
  return f;
}

/**
 * The exact values `brandVoicePrompt()` interpolates — all read FROM the committed
 * Foundation, so the Foundation (not BRAND_VOICE) is their source. Structural prose
 * in the prompt (headings, channel instructions) stays in the adapter.
 */
export type MoonVoiceModel = {
  brand: string;
  siteUrl: string;
  instagramHandle: string;
  oneLineVibe: string;
  northStarTest: string;
  posture: string;
  attributes: string[];
  easiestWay: string;
  sliders: { slider: string; lean: string; avoid: string }[];
  foundingPrinciple: string;
  do: string[];
  dont: string[];
  keywords: { core: string[]; mood: string[]; sound: string[]; belonging: string[] };
  maxMoodWordsPerPiece: number;
  labels: Record<string, string[]>;
  sampleCopy: { heroHeadlines: string[]; heroSubline: string; footer: string };
  prices: { collectionPlastic: number; collectionMetal: number; limitedPlastic: number; limitedMetal: number };
  shipping: string;
  ownModelNames: string[];
  supplierModelNames: string[];
  photoStyle: string;
  colours: { black: string; gold: string; lensBlue: string; lensPink: string; lensGreen: string; lensPeach: string };
  fonts: { primary: string; secondary: string; editorialItalic: string };
  logoName: string;
  tagline: string;
  heroCta: string;
  hashtags: string[];
  captionMax: { post: number; reel: number };
  emailSignOff: string;
  adCtaDefault: string;
};

type PromptModel = {
  siteUrl: string;
  instagramHandle: string;
  oneLineVibe: string;
  northStarTest: string;
  posture: string;
  easiestWay: string;
  sliders: { slider: string; lean: string; avoid: string }[];
  foundingPrinciple: string;
  keywords: { core: string[]; mood: string[]; sound: string[]; belonging: string[] };
  maxMoodWordsPerPiece: number;
  labels: Record<string, string[]>;
  sampleCopy: { heroHeadlines: string[]; heroSubline: string; footer: string };
  prices: { collectionPlastic: number; collectionMetal: number; limitedPlastic: number; limitedMetal: number };
  shipping: string;
  ownModelNames: string[];
  supplierModelNames: string[];
  logoName: string;
  heroCta: string;
  captionMax: { post: number; reel: number };
  emailSignOff: string;
  adCtaDefault: string;
};

/**
 * The hard gate + source of truth for brandVoicePrompt(): returns the prompt values
 * assembled from the COMMITTED Foundation's own fields (identity, voice, visual,
 * marketingPreferences). brand-voice.ts consumes this instead of reading BRAND_VOICE.
 */
export function getMoonVoiceModel(): MoonVoiceModel {
  const f = requireCommittedFoundation();
  const p = (f.marketingPreferences as { promptModel: PromptModel }).promptModel;
  const hex = (name: string): string => {
    const c = f.visual.colors.find((x) => x.name === name);
    if (!c) throw new Error(`Foundation visual colour missing: ${name}`);
    return c.hex;
  };
  const fonts = f.visual.fonts ?? [];
  return {
    brand: f.identity.name,
    siteUrl: p.siteUrl,
    instagramHandle: p.instagramHandle,
    oneLineVibe: p.oneLineVibe,
    northStarTest: p.northStarTest,
    posture: p.posture,
    attributes: f.voice.attributes,
    easiestWay: p.easiestWay,
    sliders: p.sliders,
    foundingPrinciple: p.foundingPrinciple,
    do: f.voice.do,
    dont: f.voice.dont,
    keywords: p.keywords,
    maxMoodWordsPerPiece: p.maxMoodWordsPerPiece,
    labels: p.labels,
    sampleCopy: p.sampleCopy,
    prices: p.prices,
    shipping: p.shipping,
    ownModelNames: p.ownModelNames,
    supplierModelNames: p.supplierModelNames,
    photoStyle: f.visual.photoStyle ?? "",
    colours: { black: hex("black"), gold: hex("gold"), lensBlue: hex("lensBlue"), lensPink: hex("lensPink"), lensGreen: hex("lensGreen"), lensPeach: hex("lensPeach") },
    fonts: { primary: fonts[0], secondary: fonts[1], editorialItalic: fonts[2] },
    logoName: p.logoName,
    tagline: f.identity.tagline ?? "",
    heroCta: p.heroCta,
    hashtags: (f.channelHouseStyle.social?.hashtags ?? []) as string[],
    captionMax: p.captionMax,
    emailSignOff: p.emailSignOff,
    adCtaDefault: p.adCtaDefault,
  };
}

/** Proves brand-voice.ts agrees with the committed Foundation (consumer/validator, not a rival source). */
export function assertFoundationMatchesVoice(): void {
  const f = getMoonFoundation();
  const v = BRAND_VOICE;
  const same = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Foundation/brand-voice drift: ${what}`);
  };
  same(f.identity.name, v.brand, "name");
  same(f.identity.tagline, v.tagline, "tagline");
  same(f.voice.attributes, [...v.attributes], "attributes");
  same(f.voice.do, [...v.do], "do");
  same(f.voice.dont, [...v.dont], "dont");
}
