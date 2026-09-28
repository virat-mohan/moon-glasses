import Image from "next/image";

/** Every Moonglasses frame is made with Ted Smith. */
export function TedSmithCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">In collaboration with</span>
      <Image src="/images/brand/ted-smith-logo.webp" alt="Ted Smith" width={34} height={22} className="h-5 w-auto" />
    </div>
  );
}
