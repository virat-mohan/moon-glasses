import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkAdminPassword, createAdminSessionValue, setAdminPassword } from "@/lib/admin-auth";

/** Change the admin password from inside the admin. Logs out every other session. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!(await checkAdminPassword(String(body?.currentPassword ?? "")))) {
    return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
  }
  try {
    await setAdminPassword(String(body?.newPassword ?? ""));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not change password" }, { status: 400 });
  }
  const session = await createAdminSessionValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
