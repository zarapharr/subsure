import type { NextRequest } from "next/server";
import {
  DEFAULT_AUTHENTICATED_REDIRECT,
  buildLoginRedirectUrl,
  hasSessionCookie,
  isAuthPath,
  isProtectedPath,
} from "@/lib/route-guards";

export default function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const isLoggedIn = hasSessionCookie(req.cookies.getAll().map((cookie) => cookie.name));

  if (isProtectedPath(nextUrl.pathname) && !isLoggedIn) {
    return Response.redirect(buildLoginRedirectUrl(nextUrl));
  }

  if (isAuthPath(nextUrl.pathname) && isLoggedIn) {
    return Response.redirect(new URL(DEFAULT_AUTHENTICATED_REDIRECT, nextUrl));
  }

  return;
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
