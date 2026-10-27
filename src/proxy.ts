import { NextResponse, type NextRequest } from "next/server";

/**
 * A link to one profile (the suggestion email, /discover?show=…) opened without a session: sign in first, then come
 * right back to it (the app layout's own redirect to /login can't know where the member was heading).
 */
export function proxy(req: NextRequest) {
  const show = req.nextUrl.searchParams.get("show");
  if (!show || req.cookies.get("mela_session")) return NextResponse.next();
  const login = new URL("/signup", req.url); // the email-code sign-in: works with or without a password
  login.searchParams.set("next", `/discover?show=${encodeURIComponent(show)}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: "/discover" };
