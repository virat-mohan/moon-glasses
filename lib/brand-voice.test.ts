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
    BRAND_VOICE.sampleCopy.emptyCart,
    BRAND_VOICE.sampleCopy.footer,
    BRAND_VOICE.sampleCopy.newsletter,
    "Three of us, one shared habit: we find a pair, wear it to death, then hunt the next. Friends kept asking where ours were from.",
    "Wore them all summer, could not keep them to ourselves. We bought it to wear and then people asked to buy it off us.",
  ];
  for (const s of samples) for (const kind of ["site", "social", "email", "whatsapp", "ad"] as const) assert.deepEqual(checkVoice(s, kind), [], `${kind}: ${s}`);
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

test("the credit line is allowed; Ted Smith on its own warns", () => {
  assert.deepEqual(rules("Moonglasses × Ted Smith", "site"), []);
  assert.deepEqual(rules("MOON GLASSES x Ted Smith", "site"), []);
  assert.ok(rules("Made by Ted Smith", "site").includes("warn:supplier-name"));
  assert.equal(hasBlock(checkVoice("Made by Ted Smith", "site")), false);
});

test("own model names pass", () => {
  for (const n of BRAND_VOICE.ownModelNames) assert.deepEqual(rules(`The ${n} in pale pink. Few not many.`, "social"), [], n);
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

test("open questions are listed, and unknown fields stay empty", () => {
  assert.ok(OPEN_QUESTIONS.length > 0);
  assert.equal(BRAND_VOICE.fonts.editorialItalic, undefined);
});
