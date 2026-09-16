"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Menu, X, User } from "lucide-react";
import { useCart } from "@/lib/cart";

const leftLinks = [{ label: "Shop", href: "/" }];

const rightLinks = [{ label: "About", href: "/about" }];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useCart();

  return (
    <header className="relative border-b border-[var(--moon-line)] bg-[var(--moon-black)]">
      <nav className="relative mx-auto flex h-[140px] w-full max-w-[1440px] items-center justify-between px-6 md:h-[220px] md:px-12">
        <div className="hidden items-center gap-8 md:flex">
          {leftLinks.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link text-white/70 transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <button
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
          className="text-white md:hidden"
        >
          {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>

        {/* Oversized wordmark — the header bar itself is tall enough to hold
            it, so the logo's own black canvas blends into the header
            instead of floating as a visible box over whatever's below. The
            TM is already part of the logo art next to the N — no separate
            overlay needed. */}
        <Link href="/" className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/images/brand/moon-glasses-logo.png"
            alt="MOON GLASSES"
            width={720}
            height={400}
            style={{ height: "110px", width: "auto" }}
            className="md:!h-[190px]"
            priority
          />
        </Link>

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-8 md:flex">
            {rightLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link text-white/70 transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
          <Link aria-label="Account" href="/account" className="hidden text-white md:block">
            <User size={18} strokeWidth={1.5} />
          </Link>
          <Link aria-label="Bag" href="/cart" className="relative text-white">
            <ShoppingBag size={18} strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--moon-gold)] text-[10px] font-bold text-black">
                {count}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 top-[140px] z-40 bg-[var(--moon-black)] md:hidden">
          <div className="flex flex-col gap-6 px-6 py-10">
            {[...leftLinks, ...rightLinks].map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{ transitionDelay: `${i * 35}ms` }}
                className="font-display text-heading-l uppercase text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
