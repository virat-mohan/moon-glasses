// Focused tests for the Retail OS brand config (Moon-glasses instance).
// Node's built-in test runner + type-stripping — no new dependency:
//   node --experimental-strip-types --test lib/retail-os-brand.test.ts
//
// Expected values are the EXACT strings hardcoded in app/layout.tsx, Navbar and
// the footer before this change. Any drift here means rendered output changed —
// which this migration must not do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { brand, moonglassesBrand, DEFAULT_BRAND_PROFILE, titleBrandName, validateRetailOsBrand } from "./retail-os-brand.ts";

test("active brand is Moon-glasses and config is valid", () => {
  assert.equal(brand, moonglassesBrand);
  const { ok, errors } = validateRetailOsBrand(brand);
  assert.equal(ok, true, errors.join("; "));
});

test("identity fields preserve the previous hardcoded values", () => {
  assert.equal(brand.profile.brandName, "MOON GLASSES");
  assert.equal(brand.profile.tagline, "See A Brighter You");
  assert.equal(brand.profile.siteUrl, "https://moon-glasses.store");
  assert.equal(brand.profile.productNoun, "sunglasses");
  assert.equal(brand.profile.instagramHandle, "@moonglassesonline");
  assert.equal(titleBrandName(), "MOON GLASSES™");
});

test("metadata surface values are unchanged", () => {
  assert.equal(
    brand.description,
    "MOON GLASSES™ — fashion eyewear for after dark. The Collection from ₹1,499, the Limited Series from ₹1,999. Ships across India.",
  );
  assert.deepEqual(brand.keywords, ["fashion sunglasses India", "MOON GLASSES", "eyewear", "aviator sunglasses"]);
  assert.equal(`${titleBrandName()} — ${brand.profile.tagline}`, "MOON GLASSES™ — See A Brighter You");
  assert.equal(`%s — ${titleBrandName()}`, "%s — MOON GLASSES™");
  assert.equal(brand.assets.ogImagePath, "/images/brand/moon-glasses-logo.png");
  assert.equal(`${brand.profile.siteUrl}${brand.assets.orgLogoPath}`, "https://moon-glasses.store/images/brand/moon-glasses-logo.png");
  assert.equal(brand.profile.brandName, "MOON GLASSES"); // OG siteName + org name (no ™)
});

test("Organization structured data values are unchanged", () => {
  assert.equal(brand.address?.addressCountry, "IN");
  assert.equal(brand.social?.instagram, "https://www.instagram.com/moonglassesonline/");
});

test("header logo surface is unchanged", () => {
  assert.equal(brand.assets.navLogoPath, "/images/brand/moon-glasses-logo.png");
  assert.equal(brand.assets.navLogoAlt, "MOON GLASSES");
});

test("footer copyright name is unchanged", () => {
  assert.equal(titleBrandName(), "MOON GLASSES™");
});

test("DEFAULT_BRAND_PROFILE keeps visualLanguage (Moon AI pipeline needs it)", () => {
  assert.equal(brand.profile, DEFAULT_BRAND_PROFILE);
  assert.ok(DEFAULT_BRAND_PROFILE.visualLanguage.includes("#e0b84a"));
});

test("validation catches missing/invalid required fields", () => {
  const bad = { ...moonglassesBrand, key: "", profile: { ...moonglassesBrand.profile, siteUrl: "ftp://x" } };
  const { ok, errors } = validateRetailOsBrand(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("key is required")));
  assert.ok(errors.some((e) => e.includes("siteUrl")));
});
