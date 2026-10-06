"use client";

export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={`flex h-11 w-11 items-center justify-center text-3xl leading-none ${n <= value ? "text-tan-gold" : "text-divider"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export const fieldClass =
  "w-full border border-ink/30 bg-surface px-4 py-3 font-sans text-base text-ink outline-none placeholder:text-secondary-text focus:border-ink";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center border border-ink px-6 py-2 font-sans text-base text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50";

/** Hidden from people, tempting to bots. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        website
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
