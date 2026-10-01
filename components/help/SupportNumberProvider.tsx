"use client";

import { setRuntimeSupportNumber } from "@/lib/whatsapp-help";

/** Hands the SUPPORT_WHATSAPP setting to every client-side help link. Renders nothing. */
export function SupportNumberProvider({ number, children }: { number: string | null; children: React.ReactNode }) {
  setRuntimeSupportNumber(number);
  return <>{children}</>;
}
