import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "admin_auth";

async function expectedToken(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gates every /admin page and /api/admin/* route behind a single shared
 * password (ADMIN_PASSWORD env var) — there was no protection at all before
 * this, meaning customer/lead PII and API key config were served to anyone
 * who found the URL. Deliberately simple (one password, one cookie) rather
 * than a full user/session system — this is a single-operator storefront,
 * not a multi-admin product.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    // Fail closed — no password configured means admin stays inaccessible
    // rather than silently open, which is the exact bug this fixes.
    return isAdminApi
      ? NextResponse.json({ error: "Admin is not configured" }, { status: 503 })
      : NextResponse.redirect(new URL("/admin/login?error=unconfigured", request.url));
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  const expected = await expectedToken(password);
  if (cookie === expected) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
