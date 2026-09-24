import crypto from "crypto";
import { NextResponse } from "next/server";
import { buildInstagramAuthorizeUrl } from "@/lib/instagram-connection";

const STATE_COOKIE = "ig_oauth_state";

/** Starts the one-click connect: a random state (CSRF guard, checked in the callback) then off to Instagram's login. */
export async function GET(request: Request) {
  const state = crypto.randomBytes(16).toString("hex");
  let authorizeUrl: string;
  try {
    authorizeUrl = await buildInstagramAuthorizeUrl(state);
  } catch (err) {
    const back = new URL("/admin/social", request.url);
    back.searchParams.set("instagram_error", err instanceof Error ? err.message : "Could not start");
    return NextResponse.redirect(back);
  }
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/instagram",
    maxAge: 600,
  });
  return res;
}
