import { test } from "node:test";
import assert from "node:assert/strict";
import { checkVoice, hasBlock } from "./brand-voice.ts";
import { decideFit, buildGridCaption, gridClaimAllowed, CAPTION_MAX } from "./grid-post.ts";

test("allowed ratios are kept", () => {
  assert.deepEqual(decideFit(1080, 1080), { action: "keep" });
  assert.deepEqual(decideFit(1080, 1350), { action: "keep" });
  assert.deepEqual(decideFit(1910, 1000), { action: "keep" });
});
test("tall image crops to 4:5, wide to 1.91:1, never enlarging", () => {
  assert.deepEqual(decideFit(1080, 1920), { action: "crop", width: 1080, height: 1350 });
  assert.deepEqual(decideFit(2000, 800), { action: "crop", width: 1528, height: 800 });
});
test("caption has credit, hashtags, fits and passes voice", () => {
  const c = buildGridCaption("@Some.Fan_1", (x) => (hasBlock(checkVoice(x, "social")) ? "blocked" : null));
  assert.ok(c.startsWith("📸 @Some.Fan_1"));
  assert.ok(c.includes("#MoonGlasses") && c.includes("#LightTintsGoodVibes"));
  assert.ok(c.length <= CAPTION_MAX);
  assert.throws(() => buildGridCaption("!!!"));
});
test("claim: never double-post", () => {
  const at = "x";
  assert.equal(gridClaimAllowed(null, "post"), true);
  assert.equal(gridClaimAllowed({ status: "posting", at }, "post"), false);
  assert.equal(gridClaimAllowed({ status: "posted", at }, "post"), false);
  assert.equal(gridClaimAllowed({ status: "posted", at }, "skip"), false);
  assert.equal(gridClaimAllowed({ status: "failed", at }, "post"), true);
  assert.equal(gridClaimAllowed({ status: "skipped", at }, "post"), true);
});
