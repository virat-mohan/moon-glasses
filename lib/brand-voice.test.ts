// Brand book lock tests (docs/BRAND-BOOK-STANDARD.md §3).
//   node --experimental-strip-types --test lib/brand-voice.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAND_VOICE, OPEN_QUESTIONS, brandVoicePrompt, checkVoice, hasBlock, stripHtml, voiceGate, type VoiceKind } from "./brand-voice.ts";

const rules = (text: string, kind: VoiceKind = "whatsapp") => checkVoice(text, kind).map((f) => `${f.level}:${f.rule}`);

test("the brand guide's own sample copy passes clean", () => {
  const samples = [
    ...BRAND_VOICE.sampleCopy.heroHeadlines,
    BRAND_VOICE.sampleCopy.heroSubline,
    BRAND_VOICE.sampleCopy.footer,
    "Three of us, one shared habit: we find a pair, wear it to death, then hunt the next. Friends kept asking where ours were from.",
    "Wore them all summer, could not keep them to ourselves. We bought it to wear and then people asked to buy it off us.",
  ];
  for (const s of samples) {
    for (const kind of ["site", "whatsapp", "ad"] as const) assert.deepEqual(checkVoice(s, kind), [], `${kind}: ${s}`);
    assert.deepEqual(checkVoice(`${s}\n\n#MoonGlasses #LightTintsGoodVibe`, "social"), [], `social: ${s}`);
    assert.deepEqual(checkVoice(`${s}\n\n${BRAND_VOICE.emailSignOff}`, "email"), [], `email: ${s}`);
  }
});

test("anti-keywords warn (never block)", () => {
  assert.ok(rules("Shop now").includes("warn:push-imperative"));
  assert.ok(rules("New pairs are in. Buy now!").includes("warn:push-imperative"));
  assert.ok(rules("Grab yours before Friday").includes("warn:push-imperative"));
  assert.ok(rules("Best deal of the season").includes("warn:push-imperative"));
  assert.ok(rules("Limited time offer on aviators").includes("warn:fake-urgency"));
  assert.ok(rules("Hurry, don't miss out").includes("warn:fake-urgency"));
  assert.ok(rules("Premium eyewear, affordable luxury").includes("warn:category-cliche"));
  assert.ok(rules("Elevate your look with this must-have, iconic pair").includes("warn:template-language"));
  assert.ok(rules("It's trending everywhere").includes("warn:trending-lure"));
  assert.ok(!rules("Trending").includes("warn:trending-lure"), "trending as a label is fine");
  assert.ok(rules("Dear customer, your order shipped").includes("warn:off-tone"));
  assert.equal(hasBlock(checkVoice("Shop now! Limited time! Premium luxury!", "ad")), false);
});

test("no false matches inside links, words or addresses", () => {
  assert.deepEqual(rules("See the edit at https://moon-glasses.store/shop or write to orders@moon-glasses.store"), []);
  assert.deepEqual(rules("Our workshop, a shopping trip, a bunch of friends."), []);
});

test("more than two mood words warns", () => {
  assert.ok(rules("After-hours, windows down, slow burn.").includes("warn:mood-word-stack"));
  assert.ok(!rules("After-hours, windows down.").includes("warn:mood-word-stack"));
});

test("supplier model names block in customer copy", () => {
  for (const s of ["Meet the Cosmos in pale blue.", "Our new GAST frame.", "The Striker is back.", "This pair, the Cipher, is our favourite.", "Spotted: the Graham in black.", "Ted Smith Ryder — Black Orange"]) {
    const f = checkVoice(s, "social");
    assert.ok(f.some((x) => x.level === "block" && x.rule === "supplier-model-name"), s);
  }
  assert.ok(voiceGate("Meet the Cosmos.", "email", "test").ok === false);
});

test("supplier names that are everyday words or people's names don't block without product context", () => {
  assert.equal(hasBlock(checkVoice("Hi Ravi Ford, your order is confirmed.", "whatsapp")), false);
  assert.equal(hasBlock(checkVoice("Blunt truth: we wear these every day.", "social")), false);
  assert.equal(hasBlock(checkVoice("a monk-quiet morning with blunt edges", "social")), false);
});

test("the credit line is allowed; Ted Smith on its own blocks (Virat, 2 Oct 2026)", () => {
  assert.deepEqual(rules("Moonglasses × Ted Smith", "site"), []);
  assert.deepEqual(rules("MOON GLASSES x Ted Smith", "site"), []);
  assert.ok(rules("Made by Ted Smith", "site").includes("block:supplier-name"));
});

test("own model names pass", () => {
  for (const n of BRAND_VOICE.ownModelNames) assert.deepEqual(rules(`The ${n} in pale pink. Few not many.`, "site"), [], n);
});

test("stale facts warn: paused ship-first feature and off-tier prices", () => {
  assert.ok(rules("Gift First is open today").includes("warn:stale-paused-feature"));
  assert.ok(rules("Over 5,000 followers? We ship first.").includes("warn:stale-paused-feature"));
  assert.ok(rules("Aviators from ₹1,299").includes("warn:stale-price"));
  assert.ok(rules("Priced at Rs. 999").includes("warn:stale-price"));
  assert.ok(rules("₹2,999 a pair").includes("warn:stale-price"));
  for (const ok of ["The Collection from ₹1,499", "Metal from ₹1,999", "The Limited Series at ₹2,499", "Your refund of ₹1,349 has been processed"])
    assert.ok(!rules(ok).includes("warn:stale-price"), ok);
  assert.ok(rules("₹1,499 + shipping").includes("warn:stale-shipping"));
});

test("CTA rules: labels, not commands", () => {
  assert.ok(rules("Headline\nBody\nSHOP_NOW", "ad").includes("warn:cta-imperative"));
  assert.ok(!rules("Headline\nBody\nLEARN_MORE", "ad").includes("warn:cta-imperative"));
  assert.ok(rules("Add to Cart", "site").includes("warn:cta-label"));
  assert.ok(rules("Shop the collection", "site").includes("warn:push-imperative"));
  for (const label of BRAND_VOICE.ctaExamples) assert.deepEqual(rules(label, "site"), [], label);
  const long = Array.from({ length: 45 }, () => "word").join(" ");
  assert.ok(rules(long, "site").includes("warn:long-paragraph"));
});

test("internal team sends skip the gate", () => {
  assert.equal(voiceGate("Ted Smith: Ryder — Black Orange", "email", "warehouse", { internal: true }).ok, true);
});

test("stripHtml reads email markup", () => {
  assert.match(stripHtml("<p>The&nbsp;Cosmos</p><style>.a{}</style>"), /The Cosmos/);
  assert.equal(hasBlock(checkVoice(stripHtml("<a href='https://moon-glasses.store/chapter/cosmos'>See the edit</a>"), "email")), false);
});

test("brandVoicePrompt is built from the module", () => {
  const p = brandVoicePrompt("ad");
  for (const s of ["₹1,499", "₹2,499", BRAND_VOICE.facts.whatsapp, "Pay With A Post™", "Eclipse", "Cosmos", BRAND_VOICE.oneLineVibe, "Meta ad copy", BRAND_VOICE.colours.gold])
    assert.ok(p.includes(s), s);
});

test("only the not-yet items stay open; answered fields are locked", () => {
  assert.ok(OPEN_QUESTIONS.length > 0);
  assert.ok(OPEN_QUESTIONS.every((q) => /none yet|not live yet/i.test(q)));
  assert.equal(BRAND_VOICE.fonts.editorialItalic, "Bodoni Moda");
});

test("Virat's answers, 2 Oct 2026", () => {
  // Name: Moonglasses in running copy; #MoonGlasses is fine.
  assert.ok(rules("Welcome to MOON GLASSES.").includes("warn:brand-name"));
  assert.ok(rules("Welcome to Moon Glasses.").includes("warn:brand-name"));
  assert.ok(!rules("Welcome to Moonglasses. #MoonGlasses").includes("warn:brand-name"));
  // Stale taglines.
  for (const t of ["See A Brighter You", "Light Tints Big Mood", "Light tints, big vibe"]) assert.ok(rules(t).includes("warn:stale-tagline"), t);
  assert.ok(!rules(BRAND_VOICE.tagline).includes("warn:stale-tagline"));
  // Weekly mix: block for ai/social/email, warn elsewhere.
  for (const kind of ["ai", "social", "email"] as const) assert.ok(hasBlock(checkVoice("A new mix every Friday.", kind)), kind);
  assert.ok(rules("Weekly mix drops soon", "site").includes("warn:weekly-mix-not-live"));
  assert.equal(hasBlock(checkVoice("A new mix every Friday.", "site")), false);
  // Hashtags and caption length.
  assert.ok(rules("Somewhere the night looks better.", "social").includes("warn:missing-hashtag"));
  assert.ok(!rules("Somewhere the night looks better. #MoonGlasses", "social").includes("warn:missing-hashtag"));
  const tags = " #MoonGlasses #LightTintsGoodVibe";
  assert.ok(rules("a".repeat(301) + tags, "social").includes("warn:caption-length"));
  assert.ok(!rules("Somewhere the night looks better." + tags, "social").includes("warn:caption-length"));
  assert.ok(checkVoice("b".repeat(140) + tags, "social", { format: "reel" }).some((f) => f.rule === "caption-length"));
  assert.ok(!checkVoice("x".repeat(400), "social", { format: "story" }).some((f) => f.rule === "caption-length"));
  // Email sign-off.
  assert.ok(rules("Your order is on its way.", "email").includes("warn:missing-sign-off"));
  assert.ok(!rules(`Your order is on its way.\n\n${BRAND_VOICE.emailSignOff}`, "email").includes("warn:missing-sign-off"));
  // Ad button, hero CTA, founders, prompt.
  assert.equal(BRAND_VOICE.adCtaDefault, "LEARN_MORE");
  assert.deepEqual(rules(BRAND_VOICE.heroCta, "site"), []);
  assert.ok(rules("Shop the collection", "site").includes("warn:push-imperative"));
  const p = brandVoicePrompt("social");
  for (const s of ["Moonglasses", "Light tints, good vibe", "#MoonGlasses", "#LightTintsGoodVibe", "two founders", "Bodoni Moda", "300"]) assert.ok(p.includes(s), s);
  assert.ok(brandVoicePrompt("email").includes("— Moonglasses"));
  assert.ok(brandVoicePrompt("ad").includes("LEARN_MORE"));
});

test("retired WhatsApp number is blocked; support number is fine", () => {
  assert.ok(checkVoice("whatsapp us on +91 93183 11657", "site").some((f) => f.level === "block" && f.rule === "stale-whatsapp"));
  assert.ok(!checkVoice("need a hand? wa.me/919999277240", "site").some((f) => f.rule === "stale-whatsapp"));
});
