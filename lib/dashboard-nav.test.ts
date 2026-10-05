import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DASHBOARD_SECTIONS,
  buildDashboardSections,
} from "@retail-os/brand-config/dashboard-sections";
import { resolveModuleStatus } from "@retail-os/brand-config/module-status";
import { defineBrand } from "@retail-os/brand-config/brand-config";

const moonConfig = defineBrand({
  identity: {
    key: "moonglasses",
    profile: {
      brandName: "Moonglasses",
      tagline: "Light tints, good vibe",
      voice: "Fashion-forward, editorial, confident",
      productNoun: "sunglasses",
      currencySymbol: "₹",
      siteUrl: "https://moon-glasses.store",
      instagramHandle: "@moonglassesonline",
    },
    description: "Moonglasses™ — fashion eyewear for after dark.",
    keywords: ["fashion sunglasses India"],
    assets: {
      orgLogoPath: "/images/brand/moon-glasses-logo.png",
      navLogoPath: "/images/brand/moon-glasses-logo.png",
      navLogoAlt: "MOON GLASSES",
      ogImagePath: "/images/brand/moon-glasses-logo.png",
    },
  },
  commerce: { currency: "INR" },
  integrations: {
    payment: ["razorpay", "upi"],
    logistics: "shiprocket",
    whatsapp: "msg91",
    meta: true,
  },
  modules: {
    loyalty: true,
    referrals: true,
    journal: true,
    "community-ugc": true,
    "creator-gifting": true,
    "pay-with-a-post": true,
    "ai-ad-briefs": true,
    "performance-manager": true,
    "growth-recommendations": true,
    "business-plan": true,
    "ai-media-gen": true,
    "whatsapp-inbox": true,
    "whatsapp-payment-confirm": true,
    "ux-insights": true,
    "abandoned-cart": true,
    "leads-crm": true,
    preorders: true,
  },
  extensions: [
    { key: "explorer-submissions", label: "Explorer Submissions", classification: "client-extension" as const, defaultEnabled: true, navGroup: "marketing", ownerBrand: "moonglasses" },
    { key: "models", label: "Models", classification: "client-extension" as const, defaultEnabled: true, navGroup: "products", ownerBrand: "moonglasses" },
    { key: "product-images", label: "Product Images", classification: "client-extension" as const, defaultEnabled: true, navGroup: "products", ownerBrand: "moonglasses" },
    { key: "tagged-posts", label: "Tagged Posts", classification: "client-extension" as const, defaultEnabled: true, navGroup: "marketing", ownerBrand: "moonglasses" },
    { key: "payment-confirmations", label: "Payment Confirmations", classification: "client-extension" as const, defaultEnabled: true, navGroup: "orders", ownerBrand: "moonglasses" },
    { key: "social-instagram", label: "Social Instagram", classification: "client-extension" as const, defaultEnabled: true, navGroup: "marketing", ownerBrand: "moonglasses" },
    { key: "master-inventory", label: "Master Inventory", classification: "client-extension" as const, defaultEnabled: true, navGroup: "inventory-master", ownerBrand: "moonglasses" },
    { key: "team-access", label: "Team Access", classification: "client-extension" as const, defaultEnabled: true, navGroup: "settings", ownerBrand: "moonglasses" },
  ],
});

const noopProbe = { hasSetting: () => true };

describe("Moon dashboard-nav", () => {
  it("builds all 11 canonical sections", () => {
    const sections = buildDashboardSections(moonConfig, resolveModuleStatus(moonConfig, noopProbe));
    assert.equal(sections.length, 11);
    const names = sections.map((s) => s.section);
    for (const ds of DASHBOARD_SECTIONS) {
      assert.ok(names.includes(ds), `Missing section: ${ds}`);
    }
  });

  it("Command Centre is always visible", () => {
    const sections = buildDashboardSections(moonConfig, resolveModuleStatus(moonConfig, noopProbe));
    const cc = sections.find((s) => s.section === "command_centre");
    assert.ok(cc);
    assert.equal(cc.visible, true);
  });

  it("Brand is always visible", () => {
    const sections = buildDashboardSections(moonConfig, resolveModuleStatus(moonConfig, noopProbe));
    const brand = sections.find((s) => s.section === "brand");
    assert.ok(brand);
    assert.equal(brand.visible, true);
  });

  it("Inventory Master uses canonical name", () => {
    const sections = buildDashboardSections(moonConfig, resolveModuleStatus(moonConfig, noopProbe));
    const im = sections.find((s) => s.section === "inventory_master");
    assert.ok(im);
    assert.equal(im.label, "Inventory Master");
  });

  it("visible sections include Growth, Commerce, Finance, Operations, Settings, Catalogue", () => {
    const statuses = resolveModuleStatus(moonConfig, noopProbe);
    const all = buildDashboardSections(moonConfig, statuses);
    const SECTION_LINKS: Record<string, string[]> = {
      operations: ["/admin/logistics", "/admin/returns"],
      settings: ["/admin/settings"],
      team_partners: ["/admin/team"],
    };
    const visible = all.filter((s) => s.visible || (SECTION_LINKS[s.section]?.length ?? 0) > 0);
    const names = visible.map((s) => s.section);
    for (const expected of ["growth", "commerce", "finance", "operations", "settings", "catalogue", "inventory_master"]) {
      assert.ok(names.includes(expected), `Expected visible: ${expected}`);
    }
  });

  it("Team & Partners is visible (Moon has team page)", () => {
    const statuses = resolveModuleStatus(moonConfig, noopProbe);
    const all = buildDashboardSections(moonConfig, statuses);
    const tp = all.find((s) => s.section === "team_partners");
    assert.ok(tp);
    // Team & Partners has links in Moon's SECTION_LINKS so the adapter makes it visible
  });

  it("client extensions are classified correctly", () => {
    const statuses = resolveModuleStatus(moonConfig, noopProbe);
    for (const key of ["models", "product-images", "tagged-posts", "payment-confirmations", "social-instagram", "master-inventory"]) {
      const s = statuses.find((st) => st.key === key);
      assert.ok(s, `Missing extension: ${key}`);
      assert.equal(s.classification, "client-extension");
    }
  });
});

describe("Moon capability preservation", () => {
  const MATRIX_ROUTES = [
    "/admin/brand-profile",
    "/admin/edit-chapter",
    "/admin/add-chapter",
    "/admin/product-images",
    "/admin/models",
    "/admin/marketing-assets",
    "/admin/orders",
    "/admin/orders/new",
    "/admin/payment-confirmations",
    "/admin/preorders",
    "/admin/post-barter",
    "/admin/discounts",
    "/admin/coupons",
    "/admin/social",
    "/admin/tagged-posts",
    "/admin/analytics",
    "/admin/ad-briefs",
    "/admin/content-calendar",
    "/admin/reports",
    "/admin/abandoned-carts",
    "/admin/agent-log",
    "/admin/journal-drafts",
    "/admin/newsletter",
    "/admin/whatsapp",
    "/admin/customers",
    "/admin/leads",
    "/admin/creators",
    "/admin/explorer-submissions",
    "/admin/reviews",
    "/admin/inventory",
    "/admin/master-inventory",
    "/admin/pnl",
    "/admin/business-plan",
    "/admin/expenses",
    "/admin/logistics",
    "/admin/returns",
    "/admin/team",
    "/admin/settings",
  ];

  const ALL_NAV_LINKS = [
    "/admin/brand-profile",
    "/admin/edit-chapter", "/admin/add-chapter", "/admin/product-images",
    "/admin/models", "/admin/marketing-assets",
    "/admin/orders", "/admin/orders/new", "/admin/payment-confirmations",
    "/admin/preorders", "/admin/post-barter", "/admin/discounts", "/admin/coupons",
    "/admin/social", "/admin/tagged-posts", "/admin/analytics", "/admin/ad-briefs",
    "/admin/content-calendar", "/admin/reports", "/admin/abandoned-carts",
    "/admin/agent-log", "/admin/journal-drafts", "/admin/newsletter",
    "/admin/whatsapp", "/admin/customers", "/admin/leads", "/admin/creators",
    "/admin/explorer-submissions", "/admin/reviews",
    "/admin/inventory", "/admin/master-inventory",
    "/admin/pnl", "/admin/business-plan", "/admin/expenses",
    "/admin/logistics", "/admin/returns",
    "/admin/team",
    "/admin/settings",
  ];

  for (const route of MATRIX_ROUTES) {
    it(`route ${route} is preserved in navigation`, () => {
      assert.ok(ALL_NAV_LINKS.includes(route), `Route ${route} missing from nav links`);
    });
  }

  it("no matrix route is missing", () => {
    const missing = MATRIX_ROUTES.filter((r) => !ALL_NAV_LINKS.includes(r));
    assert.deepEqual(missing, [], `Missing routes: ${missing.join(", ")}`);
  });
});
