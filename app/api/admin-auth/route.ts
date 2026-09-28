import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  acceptTeamInvite,
  completeAdminSetup,
  createAdminSessionValue,
  getAdminAuthMode,
  roleForPassword,
  type AdminRole,
} from "@/lib/admin-auth";

/** Tells the login page whether to show "enter password" or "first-time setup". */
export async function GET() {
  try {
    return NextResponse.json({ mode: await getAdminAuthMode() });
  } catch {
    return NextResponse.json({ mode: "unconfigured" });
  }
}

/** { action: "login", password } | { action: "setup", setupCode, password } | { action: "accept_invite", email, code, password } | { action: "logout" } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (body?.action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(ADMIN_COOKIE);
    return res;
  }

  try {
    let role: AdminRole = "owner";
    if (body?.action === "setup") {
      await completeAdminSetup(String(body.setupCode ?? ""), String(body.password ?? ""));
    } else if (body?.action === "accept_invite") {
      await acceptTeamInvite(String(body.email ?? ""), String(body.code ?? ""), String(body.password ?? ""));
      role = "team";
    } else if (body?.action === "login") {
      // Small fixed delay blunts rapid password guessing without needing a rate-limit store.
      await new Promise((r) => setTimeout(r, 400));
      const matched = await roleForPassword(String(body.password ?? ""));
      if (!matched) {
        return NextResponse.json({ error: "Wrong password" }, { status: 401 });
      }
      role = matched;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const session = await createAdminSessionValue(role);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Login failed" }, { status: 400 });
  }
}
