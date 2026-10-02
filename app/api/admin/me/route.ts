import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminSessionRole } from "@/lib/admin-auth";

/** Who is signed in to admin in this browser. 401 without a session (proxy also gates /api/admin/*). Used by checkout to offer test orders. */
export async function GET() {
  const role = await getAdminSessionRole((await cookies()).get(ADMIN_COOKIE)?.value).catch(() => null);
  if (!role) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ role }, { headers: { "Cache-Control": "no-store" } });
}
