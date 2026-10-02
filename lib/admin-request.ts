import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminSessionRole } from "@/lib/admin-auth";
import { resolveTestOrderFlag } from "@/lib/test-order";

/** Honours a checkout's testOrder flag only when this request carries a valid admin session cookie. */
export async function resolveTestOrderForRequest(requested: unknown): Promise<boolean> {
  if (requested !== true) return false;
  const role = await getAdminSessionRole((await cookies()).get(ADMIN_COOKIE)?.value).catch(() => null);
  return resolveTestOrderFlag(requested, role);
}
