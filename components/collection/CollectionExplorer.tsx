"use client";

import { useMemo, useState } from "react";
import { CollectionItem } from "@/components/collection/CollectionItem";
import { STYLE_ORDER, styleRimLens } from "@/lib/chapters";
import type { Chapter } from "@/types/chapter";
import type { StockLabel } from "@/lib/inventory";

type Item = { chapter: Chapter; stockLabel: StockLabel };

/**
 * "The Collection" grid plus a shape → rim colour → lens colour filter.
 * `items` must already arrive pre-sorted into style groups (see
 * groupByStyle in lib/chapters.ts) — with no filter active this renders
 * exactly that default grouped view, so the plain "scroll and browse"
 * experience is unchanged. Picking a style narrows to rim-colour chips
 * for that style; picking a rim narrows to lens-colour chips for that
 * style+rim. Each step resets the ones after it. Clicking an already-active
 * chip clears it (and everything after it) rather than doing nothing.
 */
export function CollectionExplorer({ items }: { items: Item[] }) {
  const [style, setStyle] = useState<string | null>(null);
  const [rim, setRim] = useState<string | null>(null);
  const [lens, setLens] = useState<string | null>(null);

  const withMeta = useMemo(
    () => items.map((it) => ({ ...it, meta: styleRimLens(it.chapter) })),
    [items]
  );

  const styles = useMemo(() => {
    const present = new Set(withMeta.map((it) => it.meta.style));
    return STYLE_ORDER.filter((s) => present.has(s));
  }, [withMeta]);

  const rims = useMemo(() => {
    if (!style) return [];
    const seen: string[] = [];
    for (const it of withMeta) {
      if (it.meta.style === style && !seen.includes(it.meta.rim)) seen.push(it.meta.rim);
    }
    return seen;
  }, [withMeta, style]);

  const lenses = useMemo(() => {
    if (!style || !rim) return [];
    const seen: string[] = [];
    for (const it of withMeta) {
      if (it.meta.style === style && it.meta.rim === rim && !seen.includes(it.meta.lens)) {
        seen.push(it.meta.lens);
      }
    }
    return seen;
  }, [withMeta, style, rim]);

  const filtered = useMemo(() => {
    return withMeta.filter((it) => {
      if (style && it.meta.style !== style) return false;
      if (rim && it.meta.rim !== rim) return false;
      if (lens && it.meta.lens !== lens) return false;
      return true;
    });
  }, [withMeta, style, rim, lens]);

  const hasFilter = !!style;

  function chipClass(active: boolean) {
    return `flex-none border px-4 py-2 text-caption uppercase tracking-[0.05em] transition-colors ${
      active
        ? "border-ink bg-ink text-white"
        : "border-divider text-secondary-text hover:border-ink hover:text-ink"
    }`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-caption uppercase tracking-[0.12em] text-secondary-text">Shop By Style</p>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setStyle(null);
              setRim(null);
              setLens(null);
            }}
            className="text-caption uppercase tracking-[0.05em] text-secondary-text underline underline-offset-4 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {styles.map((s) => (
          <button
            key={s}
            type="button"
            className={chipClass(style === s)}
            onClick={() => {
              if (style === s) {
                setStyle(null);
                setRim(null);
                setLens(null);
              } else {
                setStyle(s);
                setRim(null);
                setLens(null);
              }
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {style && rims.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {rims.map((r) => (
            <button
              key={r}
              type="button"
              className={chipClass(rim === r)}
              onClick={() => {
                if (rim === r) {
                  setRim(null);
                  setLens(null);
                } else {
                  setRim(r);
                  setLens(null);
                }
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {style && rim && lenses.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {lenses.map((l) => (
            <button
              key={l}
              type="button"
              className={chipClass(lens === l)}
              onClick={() => setLens(lens === l ? null : l)}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-10 text-body-s text-secondary-text">No pairs match that combination yet.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-0 md:grid-cols-4">
          {filtered.map(({ chapter, stockLabel }, i) => (
            <CollectionItem key={chapter.slug} chapter={chapter} index={i} stockLabel={stockLabel} />
          ))}
        </div>
      )}
    </div>
  );
}
