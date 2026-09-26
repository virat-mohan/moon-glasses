export type AdminNavLink = { href: string; label: string };
export type AdminTone = "terracotta" | "cobalt" | "magenta" | "gold" | "bronze";
export type AdminNavSection = { label: string; tone: AdminTone; links: AdminNavLink[] };

/** Single source of truth for admin navigation (sidebar, phone tabs, command palette, breadcrumbs). */
export const NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Store",
    tone: "terracotta",
    links: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/orders/new", label: "Add Manual Order" },
      { href: "/admin/payment-confirmations", label: "WhatsApp Payment Confirmations" },
      { href: "/admin/preorders", label: "Pre-Orders (Drop)" },
    ],
  },
  {
    label: "Marketing",
    tone: "cobalt",
    links: [
      { href: "/admin/social", label: "Social (Instagram)" },
      { href: "/admin/analytics", label: "Website Analytics" },
      { href: "/admin/ad-briefs", label: "Ad Brief Generator" },
      { href: "/admin/content-calendar", label: "Content Calendar" },
      { href: "/admin/reports", label: "Growth Reports" },
      { href: "/admin/abandoned-carts", label: "Abandoned Carts" },
      { href: "/admin/post-barter", label: "Pay With A Post" },
      { href: "/admin/agent-log", label: "Ad Agent" },
    ],
  },
  {
    label: "Logistics",
    tone: "bronze",
    links: [
      { href: "/admin/logistics", label: "Shipments & RTO" },
      { href: "/admin/returns", label: "Return Requests" },
    ],
  },
  {
    label: "Content",
    tone: "gold",
    links: [
      { href: "/admin/journal-drafts", label: "Journal Draft Generator" },
      { href: "/admin/newsletter", label: "Newsletter" },
    ],
  },
  {
    label: "Customers",
    tone: "terracotta",
    links: [
      { href: "/admin/customers", label: "Customers & Good Vibes" },
      { href: "/admin/leads", label: "Leads" },
    ],
  },
  {
    label: "Community",
    tone: "magenta",
    links: [
      { href: "/admin/creators", label: "Creators" },
      { href: "/admin/explorer-submissions", label: "Explorer Submissions" },
      { href: "/admin/reviews", label: "Reviews" },
    ],
  },
  {
    label: "Finance",
    tone: "gold",
    links: [
      { href: "/admin/pnl", label: "P&L" },
      { href: "/admin/business-plan", label: "Business Plan (Forecast)" },
      { href: "/admin/expenses", label: "Expenses" },
      { href: "/admin/discounts", label: "Discount Rules" },
      { href: "/admin/coupons", label: "Coupon Codes" },
    ],
  },
  {
    label: "Less Common",
    tone: "bronze",
    links: [
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/edit-chapter", label: "Edit Products" },
      { href: "/admin/master-inventory", label: "Inventory Master" },
      { href: "/admin/add-chapter", label: "Add Product" },
      { href: "/admin/product-images", label: "Product Images" },
      { href: "/admin/models", label: "Models" },
      { href: "/admin/marketing-assets", label: "Marketing Assets" },
      { href: "/admin/brand-profile", label: "Brand Profile" },
      { href: "/admin/settings", label: "API Keys & Settings" },
    ],
  },
];

/** Primary destinations shown as bottom tabs on phones (the rest live under "More"). */
export const PHONE_TABS: AdminNavLink[] = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/logistics", label: "Shipping" },
  { href: "/admin/pnl", label: "Money" },
];

export const ALL_LINKS = NAV_SECTIONS.flatMap((s) => s.links.map((l) => ({ ...l, section: s.label })));

/** Find the nav entry for a path, preferring the longest matching href. */
export function findNav(pathname: string) {
  let best: (typeof ALL_LINKS)[number] | undefined;
  for (const l of ALL_LINKS) {
    if (pathname === l.href || pathname.startsWith(l.href + "/")) {
      if (!best || l.href.length > best.href.length) best = l;
    }
  }
  return best;
}
