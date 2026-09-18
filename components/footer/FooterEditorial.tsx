import Link from "next/link";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "Shop All", href: "/" },
      { label: "New In", href: "/#shop" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Shipping", href: "/shipping-policy" },
      { label: "Returns", href: "/refund-policy" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function FooterEditorial() {
  return (
    <footer className="border-t border-[var(--moon-line)] bg-[var(--moon-black)] py-16">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-10 px-6 font-sans md:grid-cols-6 md:px-12">
        <div className="col-span-2">
          <p className="max-w-xs text-caption text-secondary-text">Get into the MOON.</p>
          <form className="mt-4 flex max-w-xs border-b border-white/25 pb-2">
            <input
              type="email"
              placeholder="Email"
              className="w-full bg-transparent font-sans text-body-s text-white placeholder:text-secondary-text focus:outline-none"
            />
            <button type="submit" aria-label="Subscribe" className="text-white">
              →
            </button>
          </form>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="nav-link text-secondary-text">{col.title}</p>
            <ul className="mt-4 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-body-s text-white/80 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-[1440px] items-center justify-between px-6 font-sans text-micro uppercase tracking-[0.05em] text-secondary-text md:px-12">
        <p>© {new Date().getFullYear()} MOON GLASSES™</p>
      </div>
    </footer>
  );
}
