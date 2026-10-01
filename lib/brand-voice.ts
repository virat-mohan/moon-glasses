/**
 * MOON GLASSES brand book lock: the rules every email, WhatsApp, post, ad,
 * site line and AI draft follows, and a pure checker that runs before every
 * send and every approval (docs/BRAND-BOOK-STANDARD.md).
 *
 * Sources of truth (nothing else; gaps go in OPEN_QUESTIONS, never guessed):
 * 1. "Moon Glasses Voice Guide.docx" (founders' doc): tone of voice, label
 *    replacements (Shop, Buy Now, Add to Cart, Limited Time Offer...), About copy.
 * 2. "moon-glasses-brand-voice-guide.pdf" (Brand Voice Guide, 5 pages): one-line
 *    vibe, sliders, keyword bank, anti-keywords, pull-not-push voice rules,
 *    sample copy, visual mood.
 * 3. MOON_GLASSES_CLAUDE_CODE_FINAL_PACK 2 (README.md, MOON_CLAUDE_CODE_PROMPT.md):
 *    logo, colour system, typography, hero lines, metal rule, image system.
 * 4. Repo brand profile: lib/retail-os-brand.ts (name, tagline, site, handle).
 * 5. Current repo facts: GST-inclusive price tiers (Collection plastic ₹1,499 /
 *    metal ₹1,999; Limited Series plastic ₹1,999 / metal ₹2,499), free shipping,
 *    store sender in lib/email.ts, storefront WhatsApp in
 *    components/contact/WhatsAppFloatButton.tsx, own model names (supplier names
 *    stay in product_costing.notes only). Pay With A Post™ numbers live in
 *    lib/pwap-rules.ts and are never hardcoded here.
 *
 * 6. Virat's answers to the open questions (Virat, 2 Oct 2026): two founders,
 *    gold #E7C77A, Bodoni Moda serif, "Moonglasses" in running copy, tagline
 *    "Light tints, good vibe", non-imperative hero CTA, email sign-off, hashtags,
 *    caption limits, LEARN_MORE ad button, no weekly mix yet, sender stays
 *    orders@moon-glasses.store, "Ted Smith" alone blocked.
 *
 * Pure module (no imports), so it runs under `node --test`, in the server and in
 * client components (approval screens).
 */

export type VoiceKind = "email" | "whatsapp" | "social" | "ad" | "site" | "ai";
export type VoiceLevel = "block" | "warn";
export type VoiceFinding = { level: VoiceLevel; rule: string; match: string; fix: string };

export const BRAND_VOICE = {
  sources: [
    "Moon Glasses Voice Guide.docx",
    "moon-glasses-brand-voice-guide.pdf (Brand Voice Guide)",
    "MOON_GLASSES_CLAUDE_CODE_FINAL_PACK 2: README.md, MOON_CLAUDE_CODE_PROMPT.md",
    "lib/retail-os-brand.ts",
    "Virat, 2 Oct 2026 (answers to OPEN_QUESTIONS)",
  ],
  /** Canonical name in running copy (Virat, 2 Oct 2026). The logo wordmark stays MOON GLASSES™. */
  brand: "Moonglasses",
  logoName: "MOON GLASSES™",
  /** Virat, 2 Oct 2026. */
  tagline: "Light tints, good vibe",
  /** Virat, 2 Oct 2026: two founders (the pdf's "three" is wrong). */
  founders: 2,
  /** Virat, 2 Oct 2026. */
  heroCta: "See the edit",
  /** Virat, 2 Oct 2026. */
  emailSignOff: "Light tints, good vibe.\n— Moonglasses",
  /** Virat, 2 Oct 2026. */
  hashtags: ["#MoonGlasses", "#LightTintsGoodVibe"],
  /** Virat, 2 Oct 2026: Instagram caption limits (characters). */
  captionMax: { post: 300, reel: 150 },
  /** Virat, 2 Oct 2026: default Meta ad button. */
  adCtaDefault: "LEARN_MORE",
  /** Virat, 2 Oct 2026: the weekly Friday mix does not exist yet; never promise it. */
  weeklyMixLive: false,
  siteUrl: "https://moon-glasses.store",
  instagramHandle: "@moonglassesonline",
  oneLineVibe:
    "A late-night listening room that happens to sell glasses. You wandered in because it sounded good in here. Stay as long as you like.",
  northStarTest: "Does this feel like a place people drift into, or a shop asking for something? If it asks, rewrite it.",
  posture: "Unbothered. We are already having a good time without the visitor.",
  /** Voice Guide (docx), "Tone of Voice". */
  attributes: [
    "Casual, but not careless",
    "Cool, but not trying too hard",
    "Warm, but not overly friendly",
    "Confident, but never arrogant",
    "Selective, but not exclusive",
    "Fun, but not silly",
  ],
  easiestWay: "Write like you're sending a friend the one link worth opening. Not \"Dear customer\". Not \"You need this\". More like: found these, liked them, thought you would too.",
  sliders: [
    { slider: "Fresh vs. Rooted", lean: "Fresh. Lead with what is new right now.", avoid: "Trend-chasing with no taste." },
    { slider: "Confident vs. Humble", lean: "Confident taste, humble pitch.", avoid: "Arrogance, gatekeeping, snobbery." },
    { slider: "Playful vs. Serious", lean: "Playful and unhurried.", avoid: "Jokey, meme-desperate, trying too hard." },
    { slider: "Selective vs. Exclusive", lean: "Selective. We keep the short list.", avoid: "Exclusive. If you have to ask, you are out." },
  ],
  foundingPrinciple: "We would rather show you three frames than five hundred. Copy should never feel like a warehouse; it should feel like a stylist handed you a short list and said, these are the ones.",
  do: [
    "Talk about us, not you-the-customer. We talk, people overhear.",
    "Buttons are labels, not commands: Press play, See the drop, What we are wearing, Listen in.",
    "Leave space. Short lines and silence read as confidence.",
    "Ritual over urgency: a weekly mix and a periodic drop, never scarcity pressure.",
    "Feelings as product facts: the pair for the drive home is a spec.",
    "\"We\" is really us, the two founders. If none of us would say it out loud, cut it.",
    "Short sentences, punchy rhythm. One-line hero, no forty-word paragraphs on the homepage.",
    "Specific beats poetic: concrete founder moments (wore it last Tuesday, it survived the festival).",
    "Use small case except in headlines.",
  ],
  dont: [
    "Imperatives aimed at the wallet: shop, buy, grab yours, deal.",
    "Fake urgency: limited time, don't miss out, hurry.",
    "Category clichés: luxury, premium, affordable luxury.",
    "Template language: elevate, must-have, iconic, game-changer.",
    "\"Trending\" as a come-on (fine only as a category label).",
    "Stacking more than two mood words on one page.",
    "\"Dear customer\", \"You need this\".",
  ],
  keywords: {
    core: ["cool", "easy", "effortless", "unbothered", "the pair you keep reaching for", "fits your face and fits your life", "wear it before everybody else does", "few not many"],
    mood: ["after-hours", "somewhere between dusk and dawn", "low-lights", "windows down", "last one on the dancefloor", "slow burn", "in our headphones", "the in-between hours", "no plans good company", "golden-hour", "off-duty", "quiet flex"],
    /** "new mix same friends" / "every Friday" removed until the weekly mix exists (Virat, 2 Oct 2026). */
    sound: ["playing now", "the drop", "on repeat", "press play"],
    belonging: ["if you know you know", "our kind of people", "stay a while", "same wavelength", "you would get it", "come as you are"],
  },
  maxMoodWordsPerPiece: 2,
  /** Voice Guide (docx) label replacements. */
  labels: {
    "Limited Time Offer": ["Here for now", "Around for a bit", "For now, no drama", "Small run, no noise"],
    Shop: ["See the edit", "See what's in", "Look around"],
    "Add to Cart": ["Keep this one", "I'm into this"],
    "Buy Now": ["Make it yours", "This one works", "Get it now"],
    "Limited Series": ["The limited edit", "The short run", "The drop", "The cut"],
    "The Collection": ["The main edit", "The line up", "The full edit", "The core edit"],
    "Keep Exploring": ["Join the crew, we'll stay in touch"],
  } as Record<string, string[]>,
  ctaExamples: ["Press play", "See the drop", "What we are wearing", "Listen in", "See the edit", "Look around"],
  sampleCopy: {
    heroHeadlines: ["We made a room. It sounds good in here.", "Dusk till late. Bring the right people.", "Somewhere the night looks better."],
    /** The guide's mix lines ("a new mix every week", "New mix every Friday") are held until the mix exists. */
    heroSubline: "A small edit of glasses. No rush, no noise.",
    footer: "Few styles. Worn loud. Playing soft.",
  },
  /** Final pack §21 colour system. */
  colours: {
    black: "#050505",
    ink: "#111111",
    white: "#F7F7F4",
    paper: "#F3F1EC",
    muted: "#8B8B86",
    line: "#292929",
    /** Brand gold, confirmed Virat, 2 Oct 2026. */
    gold: "#E7C77A",
    goldSoft: "#D7BA73",
    goldSecondary: "#C9A85D",
    text: "#F5F3ED",
    lensBlue: "#C9E2F5",
    lensPink: "#F2CDD5",
    lensGreen: "#D0E1CB",
    lensPeach: "#F2D5BD",
  },
  fonts: {
    primary: "Space Grotesk",
    secondary: "Inter",
    /** Virat, 2 Oct 2026: what the site loads (app/layout.tsx). */
    editorialItalic: "Bodoni Moda",
  },
  logo: "MOON wordmark with ™ at the upper-right of the N, GLASSES below in small italic widely tracked caps. Champagne gold on black, black on white. No sunglasses, icon or moon illustration with it.",
  photoStyle:
    "Golden-hour and night-out flash lighting, candid friend-group shots nobody is posing for, faces half-hidden behind lenses, lots of negative space, one bold frame per image. Lightly tinted lenses. Metal frames silver or black only, never gold. If an image looks like it is selling, it is the wrong image.",
  facts: {
    /** GST-inclusive. */
    prices: { collectionPlastic: 1499, collectionMetal: 1999, limitedPlastic: 1999, limitedMetal: 2499 },
    shipping: "Free shipping across India.",
    /** lib/email.ts sendEmail "from". */
    /** Confirmed, no separate reply-to (Virat, 2 Oct 2026). */
    sender: "orders@moon-glasses.store",
    /** Support WhatsApp = Virat's mobile, SUPPORT_WHATSAPP setting (Virat, 2 Oct 2026). */
    whatsapp: "+91 99992 77240",
    whatsappDigits: "919999277240",
    /** Retired WhatsApp numbers: flagged if they reappear in copy. */
    staleWhatsapp: ["919318311657", "+91 93183 11657", "93183 11657", "9318311657"],
    offers: ["Pay With A Post™ (rules and numbers from lib/pwap-rules.ts, never hardcoded)"],
    /** Paused / retired claims. */
    stale: ["Gift First", "5,000 followers", "5000 followers", "we ship first"],
    /** Retired taglines (Virat, 2 Oct 2026). */
    staleTaglines: ["Light tints, big vibe", "See A Brighter You", "Light Tints Big Mood", "Light Tints. Big Mood", "Light tints, big mood"],
  },
  ownModelNames: ["Eclipse", "Voltage", "Blackout", "Halo", "Luna", "Vinyl", "Encore", "Neon", "Velvet", "Midnight", "Nightrider", "Disco", "Glitch", "Siren", "Echo"],
  /** Supplier (Ted Smith) model names: never in customer-facing copy. */
  supplierModelNames: ["Cosmos", "Striker", "Gast", "Cipher", "Monk", "Lenon", "Graham", "Chelsea", "Belvedere", "Windsor", "Ford", "Synth", "Ryder", "Eyez", "Blunt"],
  /** The only place the supplier is named. "Ted Smith" anywhere else blocks (Virat, 2 Oct 2026). */
  supplierCreditLine: "Moonglasses × Ted Smith",
} as const;

/** Questions for Virat and Anun. Each one is a gap the sources don't answer; the field stays empty until answered. */
export const OPEN_QUESTIONS: string[] = [
  "Order-by / dispatch dates and offers besides Pay With A Post™: none yet (Virat, 2 Oct 2026). Add them here when there are some.",
  "Weekly Friday mix: not live yet (Virat, 2 Oct 2026). When it launches, add the link and allow the mix lines again.",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w: string, flags = "iu") => new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(w)})(?=$|[^\\p{L}\\p{N}])`, flags);

/** Plain text from an email's HTML, for checking. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|td|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;|&#39;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&times;/g, "×")
    .replace(/[ \t]+/g, " ");
}

/** Drop URLs and e-mail addresses so a link like /shop or ford.com never trips a word rule. */
function withoutLinks(t: string): string {
  return t.replace(/\bhttps?:\/\/\S+/gi, " ").replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ").replace(/\b[\w-]+\.(store|com|in|co)(\/\S*)?/gi, " ");
}

/** Supplier names that are also everyday personal names: block only next to product words. */
const PERSON_LIKE_SUPPLIER_NAMES = ["Monk", "Graham", "Chelsea", "Windsor", "Ford", "Ryder"] as const;
const PRODUCT_CONTEXT = /frame|pair|sunglass|glasses|shades|model|lens|tint|aviator|wayfarer|round|oval|square|cat.?eye|collection|limited series|black|silver|blue|pink|green|peach|brown|gold|tortoise|smoke|clear|₹/i;

const ALLOWED_PRICES =new Set(Object.values(BRAND_VOICE.facts.prices));

export type VoiceOptions = {
  /** Instagram format, for caption length. Defaults to a feed post. Stories skip the hashtag and length rules. */
  format?: "post" | "reel" | "story";
};

export function checkVoice(text: string, kind: VoiceKind, opts: VoiceOptions = {}): VoiceFinding[] {
  const raw = text ?? "";
  const out: VoiceFinding[] = [];
  const add = (level: VoiceLevel, rule: string, match: string, fix: string) => {
    if (!out.some((f) => f.rule === rule && f.match.toLowerCase() === match.toLowerCase())) out.push({ level, rule, match, fix });
  };
  // The product-page credit line is allowed verbatim.
  const t = withoutLinks(raw).replace(/moon\s*glasses\s*[×x]\s*ted\s*smith/gi, " ");
  const strict = kind === "ai" || kind === "social" || kind === "email";

  // BLOCK: supplier model names (proper-noun use). Ambiguous cases warn instead:
  // a capitalised word at the start of a sentence ("Blunt truth"), or a name that
  // is also a common personal name (a customer called Ford) with no product
  // words around it.
  for (const name of BRAND_VOICE.supplierModelNames) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(name)}|${esc(name.toUpperCase())})(?=$|[^\\p{L}\\p{N}])`, "gu");
    for (const m of t.matchAll(re)) {
      const at = (m.index ?? 0) + m[1].length;
      const before = t.slice(0, at).trimEnd();
      const around = t.slice(Math.max(0, at - 40), at + m[2].length + 40);
      const sentenceStart = before === "" || /[.!?\n:"“]$/.test(before);
      const nearTed = /ted\s*smith\s*[:\-–—]?\s*$/i.test(before);
      const personName = (PERSON_LIKE_SUPPLIER_NAMES as readonly string[]).includes(name);
      const productContext = PRODUCT_CONTEXT.test(around.replace(m[2], " "));
      const ambiguous = (sentenceStart && m[2] !== name.toUpperCase()) || (personName && !productContext);
      if (ambiguous && !nearTed) {
        add("warn", "possible-supplier-name", m[2], `"${m[2]}" is a supplier model name. If it names a frame, use our own model name (${BRAND_VOICE.ownModelNames.slice(0, 4).join(", ")}...).`);
      } else {
        add("block", "supplier-model-name", m[2], `Supplier model names never go in customer copy. Use our own model name (${BRAND_VOICE.ownModelNames.slice(0, 4).join(", ")}...).`);
      }
    }
  }
  const ted = t.match(/ted\s+smith/i);
  if (ted) add("block", "supplier-name", ted[0], `Only the credit line "${BRAND_VOICE.supplierCreditLine}" on product pages names the supplier.`);

  // WARN: brand name spelling in running copy (Virat, 2 Oct 2026). #MoonGlasses and the logo are fine.
  const spelled = t.match(/(^|[^#\p{L}])(moon\s+glasses)(?=$|[^\p{L}])/iu);
  if (spelled) add("warn", "brand-name", spelled[2], `Write "${BRAND_VOICE.brand}" in running copy.`);

  // Retired taglines.
  for (const tag of BRAND_VOICE.facts.staleTaglines) {
    const m = t.match(new RegExp(esc(tag).replace(/\\\.|,/g, "[.,]?").replace(/ /g, "\\s*"), "i"));
    if (m) { add("warn", "stale-tagline", m[0], `The tagline is now "${BRAND_VOICE.tagline}".`); break; }
  }

  // The weekly Friday mix doesn't exist yet: never promise it.
  const mix = t.match(/(new|weekly|fresh)\s+(mix|playlist)(es)?\s+(every|each)\s+(week|friday)|(weekly|friday)\s+(mix|playlist)|new\s+(mix|playlist)\s+every|(mix|playlist)\s+(every|each)\s+(week|friday)|new mix same friends/i);
  if (mix) add(strict ? "block" : "warn", "weekly-mix-not-live", mix[0], "The weekly mix isn't live yet. Don't promise it.");

  // WARN: anti-keywords (Brand Voice Guide, "Anti-Keywords, Retire These").
  const imperative = (w: string) => new RegExp(`(^|[\\n.!?:"“•|—-]\\s*)(${w})(?=$|[^\\p{L}\\p{N}])`, "iu");
  const push: [RegExp, string][] = [
    [imperative("shop(\\s+(now|the|our|all|it))?"), "See the edit / See what's in / Look around"],
    [/(^|[^\p{L}])(shop now)(?=$|[^\p{L}])/iu, "See the edit / Look around"],
    [imperative("buy(\\s+(now|it|yours|one))?"), "Make it yours / This one works"],
    [/(^|[^\p{L}])(buy now)(?=$|[^\p{L}])/iu, "Make it yours / This one works"],
    [/(^|[^\p{L}])(grab (yours|one|it|the|a|your))(?=$|[^\p{L}])/iu, "Say what it is, not what to do: \"This one works.\""],
    [/(^|[^\p{L}\p{N}])(deals?)(?=$|[^\p{L}\p{N}])/iu, "Drop the deal talk. Say what the pair is for."],
  ];
  for (const [re, fix] of push) {
    const m = t.match(re);
    if (m) add("warn", "push-imperative", m[2].trim(), fix);
  }
  const lists: [string, string[], string][] = [
    ["fake-urgency", ["limited time", "limited-time", "limited time offer", "don't miss out", "dont miss out", "don’t miss out", "don't miss", "hurry", "hurry up"], "Ritual over urgency: \"Here for now\", \"Small run, no noise\"."],
    ["category-cliche", ["luxury", "premium", "affordable luxury"], "Overused by the whole category. Say the feeling instead."],
    ["template-language", ["elevate", "elevated", "must-have", "must have", "iconic", "game-changer", "game changer"], "Template language. Use a real moment: \"wore it last Tuesday\"."],
  ];
  for (const [rule, words, fix] of lists) for (const w of words) {
    const m = t.match(wordRe(w));
    if (m) add("warn", rule, m[2], fix);
  }
  const trend = t.match(/(^|[^\p{L}])((is|are|it's|now|currently|everyone's)\s+trending|trending\s+(fast|now!|everywhere|right now))(?=$|[^\p{L}])/iu);
  if (trend) add("warn", "trending-lure", trend[2], "\"Trending\" is a label, never a lure.");
  const dear = t.match(/dear (customer|valued customer|sir|madam)|you need this/i);
  if (dear) add("warn", "off-tone", dear[0], "Write like you're sending a friend the one link worth opening.");

  // WARN: mood-word stacking (two per piece at most).
  const moods = BRAND_VOICE.keywords.mood.filter((w) => wordRe(w.replace(/-/g, " ")).test(t.replace(/-/g, " ")));
  if (moods.length > BRAND_VOICE.maxMoodWordsPerPiece)
    add("warn", "mood-word-stack", moods.join(", "), "Two mood words per piece at most. Stacking reads like a moodboard, not a voice.");

  // BLOCK: a retired WhatsApp number.
  for (const n of BRAND_VOICE.facts.staleWhatsapp) {
    if (t.includes(n)) { add("block", "stale-whatsapp", n, `Use the support WhatsApp ${BRAND_VOICE.facts.whatsapp}.`); break; }
  }
  // WARN: stale facts.
  for (const s of BRAND_VOICE.facts.stale) {
    const m = t.match(wordRe(s));
    if (m) add("warn", "stale-paused-feature", m[2], "\"We ship first\" / Gift First is paused. Talk about Pay With A Post™ from the current rules only.");
  }
  // A Moonglasses price that isn't one of the four GST-inclusive tiers.
  const priceRe = /(price[sd]?|priced at|from|starts? at|starting at|costs?|now|only|just|at|for|mrp)\s*:?\s*(₹|rs\.?|inr)\s?([\d,]{3,6})(?:\s*\/-)?|(₹|rs\.?|inr)\s?([\d,]{3,6})(?=\s*(\/-)?\s*(a pair|per pair|for (the|a|this) pair|each))/gi;
  for (const m of t.matchAll(priceRe)) {
    const n = Number((m[3] ?? m[5] ?? "").replace(/,/g, ""));
    if (n >= 500 && n <= 9999 && !ALLOWED_PRICES.has(n as 1499))
      add("warn", "stale-price", m[0].trim(), "Prices are ₹1,499 / ₹1,999 (Collection) and ₹1,999 / ₹2,499 (Limited Series), GST included.");
  }
  if (/\+\s*shipping|shipping (charges?|fee) (extra|applies|apply)/i.test(t))
    add("warn", "stale-shipping", "shipping charge", BRAND_VOICE.facts.shipping);

  // CTA rules.
  if (kind === "ad") {
    const cta = raw.match(/\bSHOP_NOW\b/);
    if (cta) add("warn", "cta-imperative", cta[0], `No imperative CTAs. Use ${BRAND_VOICE.adCtaDefault}.`);
  }
  if (kind === "social" && opts.format !== "story") {
    if (!BRAND_VOICE.hashtags.some((h) => new RegExp(`${esc(h)}(?![\\p{L}\\p{N}])`, "iu").test(raw)))
      add("warn", "missing-hashtag", "", `Add ${BRAND_VOICE.hashtags.join(" ")}.`);
    const max = opts.format === "reel" ? BRAND_VOICE.captionMax.reel : BRAND_VOICE.captionMax.post;
    if (raw.trim().length > max) add("warn", "caption-length", `${raw.trim().length} chars`, `Keep ${opts.format === "reel" ? "reel" : "post"} captions to ${max} characters.`);
  }
  if (kind === "email" && !/light tints, good vibe\.?\s*\n?\s*[—-]\s*moonglasses/i.test(raw))
    add("warn", "missing-sign-off", "", `Sign off "${BRAND_VOICE.emailSignOff.replace("\n", " ")}".`);
  if (kind === "site" || kind === "ad" || kind === "social") {
    for (const [label, alts] of [["Add to Cart", BRAND_VOICE.labels["Add to Cart"]], ["Add to Bag", BRAND_VOICE.labels["Add to Cart"]]] as const) {
      const m = t.match(wordRe(label));
      if (m) add("warn", "cta-label", m[2], `Labels, not commands: ${alts.map((a) => `"${a}"`).join(" / ")}.`);
    }
  }
  if (kind === "site") {
    for (const para of t.split(/\n\s*\n/)) {
      const words = para.trim().split(/\s+/).filter(Boolean).length;
      if (words > 40) { add("warn", "long-paragraph", `${words} words`, "No forty-word paragraphs. Short lines, leave space."); break; }
    }
  }

  return out;
}

export const hasBlock = (f: VoiceFinding[]) => f.some((x) => x.level === "block");

/** One-line summary for an error message / log. */
export function describeBlocks(f: VoiceFinding[]): string {
  return f
    .filter((x) => x.level === "block")
    .map((x) => `"${x.match}" (${x.rule}): ${x.fix}`)
    .join(" ");
}

/**
 * Send-path gate: runs checkVoice, logs every finding, and says whether the
 * send may go ahead. Internal team messages (warehouse, ops) are not customer
 * copy and skip the check.
 */
export function voiceGate(text: string, kind: VoiceKind, where: string, opts: { internal?: boolean } & VoiceOptions = {}): { ok: boolean; findings: VoiceFinding[]; reason?: string } {
  if (opts.internal) return { ok: true, findings: [] };
  const findings = checkVoice(text, kind, opts);
  if (hasBlock(findings)) {
    const reason = `Brand voice block (${where}): ${describeBlocks(findings)}`;
    console.error(reason);
    return { ok: false, findings, reason };
  }
  const warns = findings.filter((f) => f.level === "warn");
  if (warns.length) console.warn(`Brand voice warnings (${where}):`, warns.map((w) => `${w.rule}: "${w.match}"`).join("; "));
  return { ok: true, findings };
}

const KIND_LABEL: Record<VoiceKind, string> = {
  email: "an email to a customer",
  whatsapp: "a WhatsApp message",
  social: "an Instagram / Facebook post or reel caption",
  ad: "Meta ad copy",
  site: "website copy",
  ai: "customer-facing copy",
};

/** The brand book as the instruction every AI generation includes. */
export function brandVoicePrompt(kind?: VoiceKind): string {
  const v = BRAND_VOICE;
  const p = v.facts.prices;
  return [
    `You write for ${v.brand} (${v.siteUrl}, Instagram ${v.instagramHandle}). Source: the MOON GLASSES Voice Guide and Brand Voice Guide. Never write from memory or invent the brand.`,
    `The vibe: ${v.oneLineVibe} Test: ${v.northStarTest} Posture: ${v.posture}`,
    `Tone: ${v.attributes.join("; ")}. ${v.easiestWay}`,
    `Sliders: ${v.sliders.map((s) => `${s.slider}: lean ${s.lean} Avoid ${s.avoid}`).join(" | ")}`,
    `Founding principle: ${v.foundingPrinciple}`,
    `Do:\n${v.do.map((d) => `- ${d}`).join("\n")}`,
    `Never:\n${v.dont.map((d) => `- ${d}`).join("\n")}`,
    `Core words: ${v.keywords.core.join(", ")}. Mood words (max ${v.maxMoodWordsPerPiece} per piece): ${v.keywords.mood.join(", ")}. Sound/ritual words: ${v.keywords.sound.join(", ")}. Belonging words (gentle, invite only): ${v.keywords.belonging.join(", ")}.`,
    `Label replacements: ${Object.entries(v.labels).map(([k, alts]) => `instead of "${k}" say ${alts.map((a) => `"${a}"`).join(" or ")}`).join("; ")}.`,
    `Examples: ${v.sampleCopy.heroHeadlines.map((h) => `"${h}"`).join(" ")} "${v.sampleCopy.heroSubline}" "${v.sampleCopy.footer}"`,
    `Facts (only these): prices GST-inclusive, the Collection ₹${p.collectionPlastic.toLocaleString("en-IN")} plastic / ₹${p.collectionMetal.toLocaleString("en-IN")} metal, the Limited Series ₹${p.limitedPlastic.toLocaleString("en-IN")} plastic / ₹${p.limitedMetal.toLocaleString("en-IN")} metal. ${v.facts.shipping} WhatsApp ${v.facts.whatsapp}. Offer: Pay With A Post™ (do not state its numbers unless given). Never mention Gift First, follower thresholds or "we ship first".`,
    `Frame names: only our own model names (${v.ownModelNames.join(", ")}). Never write supplier model names (${v.supplierModelNames.join(", ")}) or the supplier's name.`,
    `Visuals: ${v.photoStyle} Colours ${v.colours.black} black, ${v.colours.gold} gold accent, lens tints ${v.colours.lensBlue} / ${v.colours.lensPink} / ${v.colours.lensGreen} / ${v.colours.lensPeach}. Type: ${v.fonts.primary} and ${v.fonts.secondary}, editorial italic ${v.fonts.editorialItalic}.`,
    `Name: write "${v.brand}" in running copy (the logo is ${v.logoName}). Tagline: "${v.tagline}". We are two founders. Hero/button labels: "${v.heroCta}", never "Shop".`,
    `The weekly mix is not live yet: never promise a weekly or Friday mix or playlist.`,
    kind === "social" ? `Captions: end with ${v.hashtags.join(" ")}. Post captions at most ${v.captionMax.post} characters, reels at most ${v.captionMax.reel}.` : "",
    kind === "email" ? `Emails sign off:\n${v.emailSignOff}` : "",
    kind === "ad" ? `Meta ad button: ${v.adCtaDefault}.` : "",
    kind ? `You are writing: ${KIND_LABEL[kind]}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
