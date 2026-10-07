/**
 * One-time sign-in codes get a small number of tries, so a 6-digit code can't
 * be guessed by brute force. Only the LATEST live code for an email/phone is
 * valid; after MAX_OTP_ATTEMPTS wrong tries it's burned and a new one must be
 * requested (which is itself rate-limited).
 */
export const MAX_OTP_ATTEMPTS = 5;

export type OtpRow = { code: string; consumed: boolean; expires_at: string; attempts: number | null };

export type OtpDecision = "ok" | "none" | "expired" | "locked" | "wrong";

export function decideOtp(otp: OtpRow | null | undefined, code: string, now = new Date()): OtpDecision {
  if (!otp || otp.consumed) return "none";
  if (new Date(otp.expires_at) < now) return "expired";
  if ((otp.attempts ?? 0) >= MAX_OTP_ATTEMPTS) return "locked";
  return otp.code === String(code).trim() ? "ok" : "wrong";
}
