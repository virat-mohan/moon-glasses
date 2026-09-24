import { NextResponse } from "next/server";
import { completeInstagramLogin } from "@/lib/instagram-connection";

const STATE_COOKIE = "ig_oauth_state";

/** Instagram sends the admin back here after they approve. Lives under /api/admin, so the admin login gate applies too. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL("/admin/social", url);
  const fail = (message: string) => {
    back.searchParams.set("instagram_error", message);
    const res = NextResponse.redirect(back);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/admin/instagram" });
    return res;
  };

  const expectedState = request.headers.get("cookie")?.match(new RegExp(`${STATE_COOKIE}=([a-f0-9]+)`))?.[1];
  if (url.searchParams.get("error")) {
    return fail(url.searchParams.get("error_description") ?? "Instagram login was cancelled");
  }
  if (!expectedState || url.searchParams.get("state") !== expectedState) {
    return fail("Login session expired — click Connect again");
  }
  // Instagram appends "#_" to the code in some flows; it isn't part of the code.
  const code = url.searchParams.get("code")?.replace(/#_$/, "");
  if (!code) return fail("Instagram didn't send a login code");

  try {
    const connection = await completeInstagramLogin(code);
    back.searchParams.set("instagram", `connected:${connection.username}`);
    const res = NextResponse.redirect(back);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/admin/instagram" });
    return res;
  } catch (err) {
    console.error("Instagram connect failed", err);
    return fail(err instanceof Error ? err.message : "Connecting Instagram failed");
  }
}
