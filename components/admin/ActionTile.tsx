import type { ReactNode } from "react";

/** One labelled action: a plain-verb button plus a one-line "what this does" hint. */
export function ActionTile({ children, hint, feedback }: { children: ReactNode; hint: string; feedback?: ReactNode }) {
  return (
    <div className="ord-action">
      {children}
      <p className="ord-hint">{hint}</p>
      {feedback}
    </div>
  );
}
