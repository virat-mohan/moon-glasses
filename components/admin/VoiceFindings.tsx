"use client";

import { checkVoice, hasBlock, type VoiceFinding, type VoiceKind } from "@/lib/brand-voice";

/** Brand book lock on approval screens: findings for the copy about to be approved. Pair with voiceBlocked() to disable approve. */
export function voiceFindingsFor(text: string, kind: VoiceKind): VoiceFinding[] {
  return text.trim() ? checkVoice(text, kind) : [];
}

export function voiceBlocked(text: string, kind: VoiceKind): boolean {
  return hasBlock(voiceFindingsFor(text, kind));
}

export function VoiceFindings({ text, kind, className = "" }: { text: string; kind: VoiceKind; className?: string }) {
  const findings = voiceFindingsFor(text, kind);
  if (findings.length === 0) return null;
  const blocked = hasBlock(findings);
  return (
    <div
      className={`rounded border px-3 py-2 text-xs ${blocked ? "border-red-400 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"} ${className}`}
      role={blocked ? "alert" : "status"}
    >
      <p className="mb-1 font-semibold">
        {blocked ? "Brand book: blocked. Fix before approving." : "Brand book: check these before approving."}
      </p>
      <ul className="space-y-0.5">
        {findings.map((f, i) => (
          <li key={`${f.rule}-${i}`}>
            <span className="font-semibold uppercase">{f.level}</span> · {f.rule}
            {f.match ? <> · &ldquo;{f.match}&rdquo;</> : null} — {f.fix}
          </li>
        ))}
      </ul>
    </div>
  );
}
