import Link from "next/link";

const NAV_SECTIONS = [
  {
    label: "Store",
    links: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/orders/new", label: "Add Manual Order" },
      { href: "/admin/preorders", label: "Pre-Orders (Drop)" },
    ],
  },
  {
    label: "Marketing",
    links: [
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
    links: [
      { href: "/admin/logistics", label: "Shipments & RTO" },
      { href: "/admin/returns", label: "Return Requests" },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/journal-drafts", label: "Journal Draft Generator" },
      { href: "/admin/newsletter", label: "Newsletter" },
    ],
  },
  {
    label: "Customers",
    links: [
      { href: "/admin/customers", label: "Customers & Good Vibes" },
      { href: "/admin/leads", label: "Leads" },
    ],
  },
  {
    label: "Community",
    links: [
      { href: "/admin/creators", label: "Creators" },
      { href: "/admin/explorer-submissions", label: "Explorer Submissions" },
      { href: "/admin/reviews", label: "Reviews" },
    ],
  },
  {
    label: "Finance",
    links: [
      { href: "/admin/pnl", label: "P&L" },
      { href: "/admin/expenses", label: "Expenses" },
      { href: "/admin/discounts", label: "Discount Rules" },
      { href: "/admin/coupons", label: "Coupon Codes" },
    ],
  },
  {
    label: "Less Common",
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-[22rem] shrink-0 flex-col overflow-y-auto border-r border-divider bg-surface px-5 pt-8 pb-10 md:flex">
        <p className="mb-4 text-micro uppercase tracking-[0.15em] text-secondary-text">Admin</p>
        <nav>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-6 break-inside-avoid">
              <p className="mb-2 text-micro uppercase tracking-[0.1em] text-secondary-text/70">
                {section.label}
              </p>
              <ul className="space-y-1.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block text-body-s text-ink hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
