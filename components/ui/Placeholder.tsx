type Accent = "forest" | "ocean" | "clay" | "stone" | "sand" | "olive" | "mist";

const ACCENT_VAR: Record<Accent, string> = {
  forest: "var(--color-forest)",
  ocean: "var(--color-ocean)",
  clay: "var(--color-clay)",
  stone: "var(--color-stone)",
  sand: "var(--color-sand)",
  olive: "var(--color-olive)",
  mist: "var(--color-mist)",
};

type PlaceholderProps = {
  accent?: Accent;
  aspectClassName?: string;
  label?: string;
  className?: string;
};

/**
 * Elegant stand-in for missing photography.
 * Design system rule: never grey blocks, never blank — soft gradient + grain + mark.
 * Swap for real imagery via next/image once assets are supplied.
 */
export function Placeholder({
  accent = "sand",
  aspectClassName = "aspect-[4/5]",
  label,
  className = "",
}: PlaceholderProps) {
  const tone = ACCENT_VAR[accent];

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${aspectClassName} ${className}`}
      style={{
        backgroundImage: `radial-gradient(120% 120% at 15% 10%, color-mix(in srgb, ${tone} 35%, var(--color-warm-white)) 0%, var(--color-surface-alt) 65%)`,
      }}
    >
      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* mark */}
      <svg
        className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-25"
        viewBox="0 0 24 24"
        fill="none"
        stroke={tone}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9.5 12 12l2.5 2.5M9.5 9.5 12 12l-2.5 2.5" />
      </svg>

      {label && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/25 to-transparent px-4 py-3">
          <p className="text-micro tracking-wide text-white/90">{label}</p>
        </div>
      )}
    </div>
  );
}
