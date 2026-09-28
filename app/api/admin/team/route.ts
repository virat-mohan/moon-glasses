import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBrandProfile } from "@/lib/brand";
import { ADMIN_COOKIE, getAdminSessionRole, inviteTeamMember, listTeam, removeTeamMember } from "@/lib/admin-auth";

async function isOwner() {
  return (await getAdminSessionRole((await cookies()).get(ADMIN_COOKIE)?.value)) === "owner";
}

export async function GET() {
  if (!(await isOwner())) return NextResponse.json({ error: "Only the owner can manage team access" }, { status: 403 });
  return NextResponse.json(await listTeam());
}

/** { email } → a one-time invite link, shown once for the owner to send. */
export async function POST(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "Only the owner can manage team access" }, { status: 403 });
  const body = await request.json().catch(() => null);
  try {
    const email = String(body?.email ?? "");
    const code = await inviteTeamMember(email);
    const site = (await getBrandProfile()).siteUrl.replace(/\/$/, "").replace(/^https:\/\/(?!www\.)/, "https://www.");
    const link = `${site}/admin-login?invite=${encodeURIComponent(code)}&email=${encodeURIComponent(email.trim().toLowerCase())}`;
    return NextResponse.json({ link });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create invite" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "Only the owner can manage team access" }, { status: 403 });
  const body = await request.json().catch(() => null);
  await removeTeamMember(String(body?.email ?? ""));
  return NextResponse.json({ ok: true });
}
