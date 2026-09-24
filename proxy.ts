import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminSession } from "@/lib/admin-auth";

/**
 * Gates every /admin page and /api/admin/* route behind the admin session.
 * Before this, the whole admin — including "Mark Paid", which ships real
 * product — was open to anyone with the URL. Login and first-run setup live
 * outside the matcher (/admin-login, /api/admin-auth/*) so they stay reachable.
 * Fails closed: any error reading the session means no access.
 */
export async function proxy(request: NextRequest) {
  let ok = false;
  try {
    ok = await isValidAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);
  } catch (err) {
    console.error("Admin session check failed", err);
  }
  if (ok) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/admin-login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
