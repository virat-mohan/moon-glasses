import { PayWithAPostMark } from "@/components/ui/PayWithAPostMark";

/** Slim pre-launch strip above the navbar — only rendered while LAUNCH_SOON is on. */
export function LaunchingSoonBar() {
  return (
    <a
      href="/#join"
      className="block border-b border-[var(--moon-line)] bg-[var(--moon-black)] px-4 py-2.5 text-center font-sans text-micro uppercase tracking-[0.12em] text-white/80 transition-colors hover:text-white md:text-caption"
    >
      <span className="font-bold text-tan-gold">Launching soon</span>
      <span className="mx-2 text-white/40">·</span>
      the first drop, plus <PayWithAPostMark className="mx-[0.15em]" />
      <span className="mx-2 text-white/40">·</span>
      <span className="underline underline-offset-4">get on the list</span>
    </a>
  );
}
