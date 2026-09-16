type GlyphProps = { className?: string };

/**
 * Bold flat-colour "patch tile" glyphs, redrawn from each Story Series' embroidery
 * motif — approximations from product photography, not the original artwork files.
 * Each returns a complete little patch: background fill + line art, bordered like
 * the real embroidered badges.
 */

function PatchFrame({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <rect x="1.5" y="1.5" width="61" height="61" rx="10" fill={bg} />
      <rect x="1.5" y="1.5" width="61" height="61" rx="10" fill="none" stroke="var(--color-warm-white)" strokeWidth="3" />
      {children}
    </svg>
  );
}

export function SunsetGlyph({ className }: GlyphProps) {
  return (
    <div className={className}>
      <PatchFrame bg="var(--color-paint-indigo)">
        <circle cx="32" cy="26" r="10" fill="var(--color-paint-amber)" />
        <path d="M8 40h48M10 46h44M14 52h36" stroke="var(--color-paint-orange)" strokeWidth="4" strokeLinecap="round" />
      </PatchFrame>
    </div>
  );
}

export function WildlingGlyph({ className }: GlyphProps) {
  return (
    <div className={className}>
      <PatchFrame bg="var(--color-paint-teal)">
        <path
          d="M12 46 22 20l7 11 7-14 16 29z"
          fill="var(--color-paint-indigo)"
          stroke="var(--color-warm-white)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="46" cy="16" r="4" fill="var(--color-paint-amber)" />
      </PatchFrame>
    </div>
  );
}

export function HorizonGlyph({ className }: GlyphProps) {
  return (
    <div className={className}>
      <PatchFrame bg="var(--color-paint-orange)">
        <path d="M10 30 24 14l10 12" stroke="var(--color-warm-white)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <path d="M8 42q8-7 16 0t16 0 16 0" stroke="var(--color-paint-indigo)" strokeWidth="4" fill="none" strokeLinecap="round" />
      </PatchFrame>
    </div>
  );
}

export function SkylineGlyph({ className }: GlyphProps) {
  return (
    <div className={className}>
      <PatchFrame bg="var(--color-charcoal)">
        <path
          d="M8 48V28h7V18h8v10h6V14h8v14h6v-8h7v18z"
          fill="var(--color-warm-white)"
        />
        <path d="M6 48h52" stroke="var(--color-paint-amber)" strokeWidth="3" strokeLinecap="round" />
      </PatchFrame>
    </div>
  );
}

export function PeakingGlyph({ className }: GlyphProps) {
  return (
    <div className={className}>
      <PatchFrame bg="var(--color-paint-plum)">
        <path
          d="M8 46 22 20l8 12 5-7 19 21z"
          fill="var(--color-warm-white)"
          stroke="var(--color-paint-indigo)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="47" cy="14" r="4" fill="var(--color-paint-amber)" />
      </PatchFrame>
    </div>
  );
}

export function DunesGlyph({ className }: GlyphProps) {
  return (
    <div className={className}>
      <PatchFrame bg="var(--color-paint-indigo)">
        <path d="M40 10a8 8 0 100 16 8 8 0 010-16z" fill="var(--color-warm-white)" />
        <path
          d="M6 38q8-9 16-2t16-1 16 2v14H6z"
          fill="var(--color-paint-orange)"
          stroke="var(--color-warm-white)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </PatchFrame>
    </div>
  );
}
