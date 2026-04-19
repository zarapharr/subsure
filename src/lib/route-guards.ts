export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const DEFAULT_AUTHENTICATED_REDIRECT = "/app";

const PROTECTED_PATH_PREFIXES = [DEFAULT_AUTHENTICATED_REDIRECT] as const;
const AUTH_PATHS = [LOGIN_PATH, SIGNUP_PATH] as const;
const SESSION_COOKIE_PREFIXES = ["authjs.session-token", "__Secure-authjs.session-token"] as const;

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function matchesPath(pathname: string, targetPath: string) {
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

export function isProtectedPath(pathname: string) {
  const normalizedPath = normalizePath(pathname);
  return PROTECTED_PATH_PREFIXES.some((pathPrefix) => matchesPath(normalizedPath, pathPrefix));
}

export function isAuthPath(pathname: string) {
  const normalizedPath = normalizePath(pathname);
  return AUTH_PATHS.some((path) => matchesPath(normalizedPath, path));
}

export function buildLoginRedirectUrl(nextUrl: URL) {
  const loginUrl = new URL(LOGIN_PATH, nextUrl);
  const callbackUrl = `${nextUrl.pathname}${nextUrl.search}`;
  if (callbackUrl !== LOGIN_PATH) {
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
  }
  return loginUrl;
}

export function sanitizeCallbackUrl(input: unknown) {
  if (typeof input !== "string") return DEFAULT_AUTHENTICATED_REDIRECT;
  if (!input.startsWith("/") || input.startsWith("//")) return DEFAULT_AUTHENTICATED_REDIRECT;
  return input;
}

export function hasSessionCookie(cookieNames: string[]) {
  return cookieNames.some((cookieName) =>
    SESSION_COOKIE_PREFIXES.some(
      (cookiePrefix) => cookieName === cookiePrefix || cookieName.startsWith(`${cookiePrefix}.`),
    ),
  );
}
