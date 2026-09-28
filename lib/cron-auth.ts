import { getSetting } from "@/lib/settings";

/**
 * Scheduled jobs only run for a caller holding CRON_SECRET. Vercel Cron sends
 * it automatically as "Authorization: Bearer <CRON_SECRET>" when the env var
 * is set on the project; an external scheduler can pass ?secret= or
 * x-cron-secret instead. With no secret configured anywhere, every request is
 * refused rather than left open.
 */
export async function isCronAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET || (await getSetting("CRON_SECRET"));
  if (!secret) return process.env.NODE_ENV === "development";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = bearer || new URL(request.url).searchParams.get("secret") || request.headers.get("x-cron-secret");
  return provided === secret;
}
