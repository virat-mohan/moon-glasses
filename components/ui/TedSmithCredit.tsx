import Image from "next/image";

/** Every Moonglasses frame is made with Ted Smith. */
export function TedSmithCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="font-sans text-micro uppercase tracking-[0.1em] text-secondary-text">In collaboration with</span>
      <Image src="/images/brand/ted-smith-logo.webp" alt="Ted Smith" width={62} height={40} className="h-10 w-auto" />
    </div>
  );
}
