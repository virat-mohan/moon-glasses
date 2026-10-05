import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getMoonFoundation, requireCommittedFoundation, assertFoundationMatchesVoice, RECONCILIATION_ITEMS,
  getMoonVoiceModel,
} from "./brand-foundation.ts";
import { brandVoicePrompt } from "./brand-voice.ts";
import {
  defineBrandFoundation, isDownstreamAllowed, transitionFoundation,
} from "@retail-os/brand-config/brand-foundation";

const here = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(join(here, "__fixtures__/brandVoicePrompt.baseline.json"), "utf8")) as Record<string, string>;

test("Moon Foundation is committed and downstream-allowed", () => {
  const f = getMoonFoundation();
  assert.equal(f.status, "committed");
  assert.equal(isDownstreamAllowed(f), true);
  assert.equal(requireCommittedFoundation().key, "moonglasses");
});

test("the gate: a non-committed foundation cannot drive downstream output", () => {
  const draft = defineBrandFoundation({
    key: "moonglasses", identity: { name: "Moonglasses", positioning: "x", valueProposition: "y" }, icp: { audience: "a" },
  });
  assert.equal(isDownstreamAllowed(draft), false); // draft
  const reviewed = transitionFoundation(draft, "review");
  assert.equal(isDownstreamAllowed(reviewed), false); // review
  const approved = transitionFoundation(
    { ...reviewed, voice: { ...reviewed.voice, attributes: ["cool"] }, sources: [{ label: "s", confidence: "founder_approved" }] },
    "approved", { approvedBy: "Virat" },
  );
  assert.equal(isDownstreamAllowed(approved), false);
  assert.equal(isDownstreamAllowed(transitionFoundation(approved, "committed")), true);
});

test("brand-voice agrees with the committed Foundation (consumer, not a rival source)", () => {
  assert.doesNotThrow(() => assertFoundationMatchesVoice());
});

test("brandVoicePrompt output is byte-identical to the pre-change baseline (no drift)", () => {
  for (const [k, expected] of Object.entries(baseline)) {
    const kind = k === "undefined" ? undefined : (k as any);
    assert.equal(brandVoicePrompt(kind), expected, `brandVoicePrompt(${k}) changed`);
  }
});

test("brandVoicePrompt's values are sourced from the committed Foundation, not BRAND_VOICE", () => {
  const f = getMoonFoundation();
  const m = getMoonVoiceModel();
  assert.equal(m.brand, f.identity.name);
  assert.equal(m.tagline, f.identity.tagline);
  assert.deepEqual(m.attributes, f.voice.attributes);
  assert.deepEqual(m.do, f.voice.do);
  assert.equal(m.colours.gold, f.visual.colors.find((c) => c.name === "gold")?.hex);
  assert.equal(m.photoStyle, f.visual.photoStyle);
  const p = (f.marketingPreferences as any).promptModel;
  assert.equal(m.oneLineVibe, p.oneLineVibe);
  assert.equal(m.prices.collectionPlastic, p.prices.collectionPlastic);
  assert.deepEqual(m.ownModelNames, p.ownModelNames);
});

test("genuine unresolved / held items are recorded, not auto-committed", () => {
  assert.ok(RECONCILIATION_ITEMS.length >= 1);
  assert.ok(RECONCILIATION_ITEMS.some((x) => /weekly|mix/i.test(x)));
});
