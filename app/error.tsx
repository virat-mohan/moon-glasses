"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Error</p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Something slipped on our side.</h1>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={() => retry()}
          className="border border-ink px-6 py-2.5 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink hover:bg-ink hover:text-cream"
        >
          Try again
        </button>
        <Link href="/" className="text-caption text-secondary-text underline-offset-4 hover:underline">
          back to the home page
        </Link>
      </div>
      <p className="mt-6">
        <WhatsAppHelp
          label="something not working? whatsapp us"
          topic="page error"
          lines={[`page: ${pathname}`, `error: ${error.digest ? `ref ${error.digest}` : error.message}`]}
        />
      </p>
    </main>
  );
}
