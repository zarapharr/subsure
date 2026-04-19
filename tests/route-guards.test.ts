import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTHENTICATED_REDIRECT,
  buildLoginRedirectUrl,
  hasSessionCookie,
  isAuthPath,
  isProtectedPath,
  sanitizeCallbackUrl,
} from "@/lib/route-guards";

describe("route guards", () => {
  it("matches protected app paths", () => {
    expect(isProtectedPath("/app")).toBe(true);
    expect(isProtectedPath("/app/")).toBe(true);
    expect(isProtectedPath("/app/dashboard")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("matches auth paths", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup/")).toBe(true);
    expect(isAuthPath("/signup/confirm")).toBe(true);
    expect(isAuthPath("/app")).toBe(false);
  });

  it("builds login redirects with callbackUrl", () => {
    const redirect = buildLoginRedirectUrl(new URL("https://app.example.com/app?tab=overview"));
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("callbackUrl")).toBe("/app?tab=overview");
  });

  it("sanitizes callback urls", () => {
    expect(sanitizeCallbackUrl("/app")).toBe("/app");
    expect(sanitizeCallbackUrl("/app?tab=overview")).toBe("/app?tab=overview");
    expect(sanitizeCallbackUrl("https://evil.example.com")).toBe(DEFAULT_AUTHENTICATED_REDIRECT);
    expect(sanitizeCallbackUrl("//evil.example.com")).toBe(DEFAULT_AUTHENTICATED_REDIRECT);
    expect(sanitizeCallbackUrl(undefined)).toBe(DEFAULT_AUTHENTICATED_REDIRECT);
  });

  it("detects auth session cookies including chunked tokens", () => {
    expect(hasSessionCookie(["authjs.session-token"])).toBe(true);
    expect(hasSessionCookie(["__Secure-authjs.session-token.0"])).toBe(true);
    expect(hasSessionCookie(["next-auth.session-token"])).toBe(false);
    expect(hasSessionCookie(["foo", "bar"])).toBe(false);
  });
});
