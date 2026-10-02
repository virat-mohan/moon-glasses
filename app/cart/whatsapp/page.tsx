import type { Metadata } from "next";
import Link from "next/link";
import { verifyCartToken } from "@/lib/cart-token";
import { getAllChapters } from "@/lib/chapters-dynamic";
import { liveCatalogue } from "@/lib/catalogue";
import { getInventoryMap } from "@/lib/inventory";
import { validateWaCart } from "@/lib/wa-order";
import { chapterImageSrc } from "@/lib/chapters";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";
import { LoadCart } from "./LoadCart";

export const metadata: Metadata = { title: "Your cart · Moonglasses", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Web fallback for a WhatsApp cart. Token is verified server-side and every line is re-priced from the catalogue. */
export default async function WhatsAppCartPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const v = c ? verifyCartToken(c) : ({ ok: false, reason: "malformed" } as const);
  let lines: { chapter: Awaited<ReturnType<typeof getAllChapters>>[number]; image: string; quantity: number }[] = [];
  if (v.ok) {
    const chapters = await getAllChapters();
    const cart = validateWaCart(v.lines.map((l) => ({ retailerId: l.s, qty: l.q })), liveCatalogue(chapters), await getInventoryMap(), chapters.map((x) => x.slug));
    lines = cart.lines.flatMap((l) => {
      const chapter = chapters.find((x) => x.slug === l.slug);
      return chapter ? [{ chapter, image: chapterImageSrc(chapter.folder, chapter.sideImage), quantity: l.qty }] : [];
    });
  }
  if (lines.length) return <LoadCart lines={lines} />;

  return (
    <main className="mx-auto w-full max-w-[480px] px-6 pb-24 pt-32 text-center">
      <h1 className="font-display text-heading-xl uppercase text-ink">That Cart Has Expired.</h1>
      <p className="mt-4 text-body text-secondary-text">
        {v.ok ? "The pairs in it aren't available right now." : "This link has expired or isn't quite right."} The catalogue has everything that&apos;s live, and you can send a fresh cart from WhatsApp too.
      </p>
      <Link href="/catalogue" className="mt-6 inline-flex min-h-[44px] items-center border border-ink px-6 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink">See the catalogue</Link>
      <p className="mt-6"><WhatsAppHelp topic="my whatsapp cart link" lines={["page: /cart/whatsapp"]} /></p>
    </main>
  );
}
