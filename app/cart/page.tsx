"use client";

import { Suspense, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useDiscountRule } from "@/lib/useDiscountRule";
import { calculateDiscount, describeDiscountRule } from "@/lib/discounts";
import { parseCartDeepLink } from "@/lib/cart-deep-link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

/**
 * Lands a WhatsApp-catalog order (or any pre-built cart shared as a link)
 * straight into the real checkout flow — one-time on mount, then the
 * `items` param is stripped so refreshing/back-nav doesn't re-add it.
 * Split out because useSearchParams() requires a Suspense boundary.
 */
function CartDeepLinkApplier() {
  const { addItem, loaded } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedDeepLink = useRef(false);

  useEffect(() => {
    if (appliedDeepLink.current || !loaded) return;
    const itemsParam = searchParams.get("items");
    if (!itemsParam) return;
    appliedDeepLink.current = true;

    for (const { chapter, image, quantity } of parseCartDeepLink(itemsParam)) {
      addItem(chapter, image, quantity);
    }
    router.replace("/cart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loaded]);

  return null;
}

export default function CartPage() {
  const { items, setQuantity, removeItem, subtotal } = useCart();
  const discountRule = useDiscountRule();
  const discount = calculateDiscount(items, discountRule);
  const total = subtotal - discount;

  return (
    <>
      <Suspense fallback={null}>
        <CartDeepLinkApplier />
      </Suspense>
      <main className="mx-auto w-full max-w-[900px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Your Cart</p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          {items.length > 0 ? "Almost There." : "Empty, For Now."}
        </h1>

        {items.length === 0 ? (
          <div className="mt-16 border-t border-divider py-24 text-center">
            <p className="text-body text-secondary-text">
              Nothing in your cart yet — every Chapter starts somewhere.
            </p>
            <Link
              href="/series"
              className="mt-6 inline-block border border-ink px-8 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
            >
              Browse The Series
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-12 divide-y divide-divider border-y border-divider">
              {items.map((item) => (
                <div key={item.slug} className="flex flex-wrap items-center gap-4 py-6 sm:flex-nowrap sm:gap-5">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-surface-alt sm:h-24 sm:w-24">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover object-bottom"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/chapter/${item.slug}`}
                      className="font-sans text-body-s uppercase tracking-[0.03em] text-ink hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-caption text-secondary-text">
                      ₹{item.price.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
                    <div className="flex items-center gap-3 border border-divider px-3 py-1.5">
                      <button
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity(item.slug, item.quantity - 1)}
                        className="text-ink"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-4 text-center text-body-s text-ink">{item.quantity}</span>
                      <button
                        aria-label="Increase quantity"
                        onClick={() => setQuantity(item.slug, item.quantity + 1)}
                        className="text-ink"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      aria-label="Remove"
                      onClick={() => removeItem(item.slug)}
                      className="text-secondary-text transition-colors hover:text-ink"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <p className="w-full text-right font-sans text-body-s text-ink sm:w-20">
                    ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <p className="font-sans text-body text-ink">Subtotal</p>
              <p className="font-sans text-body text-ink">₹{subtotal.toLocaleString("en-IN")}</p>
            </div>

            {discount > 0 && discountRule && (
              <div className="mt-2 flex items-center justify-between">
                <p className="font-sans text-body-s text-tan-gold">{describeDiscountRule(discountRule)}</p>
                <p className="font-sans text-body-s text-tan-gold">
                  −₹{discount.toLocaleString("en-IN")}
                </p>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-divider pt-3">
              <p className="font-sans text-body text-ink">Total</p>
              <p className="font-display text-heading-m text-ink">₹{total.toLocaleString("en-IN")}</p>
            </div>
            <p className="mt-2 text-caption text-secondary-text">
              Shipping and any taxes are calculated at checkout.
            </p>

            <Link
              href="/checkout"
              className="mt-8 block w-full border border-ink bg-ink px-8 py-4 text-center font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
            >
              Proceed to Checkout
            </Link>
          </>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
