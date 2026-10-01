import Link from "next/link";
import { WhatsAppHelp } from "@/components/help/WhatsAppHelp";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Page Not Found" };

export default async function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">404</p>
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">This page wandered off.</h1>
      <p className="mt-6">
        <Link href="/" className="text-body-s text-ink underline-offset-4 hover:underline">
          back to the home page
        </Link>
      </p>
      <p className="mt-3">
        <WhatsAppHelp
          label="something not working? whatsapp us"
          topic="page not found"
          lines={["error: 404 page not found"]}
          number={await getSetting("SUPPORT_WHATSAPP")}
        />
      </p>
    </main>
  );
}
