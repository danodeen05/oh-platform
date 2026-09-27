import { NextRequest } from "next/server";

/**
 * Drop Clerk handshake cookies that belong to a different Clerk instance.
 *
 * The production instance's frontend API lives at clerk.ohbeef.com, so the
 * handshake cookies it sets are scoped to ".ohbeef.com" and ride along to every
 * dev host (devadmin.ohbeef.com, devwebapp.ohbeef.com). A test instance's
 * frontend API lives on accounts.dev and delivers its handshake through the URL,
 * never through a cookie on our domain, so when this app runs on a pk_test_ key
 * any __clerk_handshake cookie is foreign. clerkMiddleware verifies it before
 * our handler runs and throws on the key-id mismatch:
 *
 *   Clerk: Handshake token verification failed: Unable to find a signing key in
 *   JWKS that matches the kid=... (reason=jwk-kid-mismatch)
 *
 * So on a test key we strip those cookies from the request before Clerk sees it
 * and expire them in the browser so the next request is clean.
 */
const FOREIGN_HANDSHAKE_COOKIES = ["__clerk_handshake", "__clerk_handshake_nonce"];

const usesTestInstance = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test_");

/** Returns a copy of the request without foreign handshake cookies, or null if none were present. */
export function withoutForeignHandshakeCookies(request: NextRequest): NextRequest | null {
  if (!usesTestInstance) return null;
  const raw = request.headers.get("cookie");
  if (!raw) return null;

  const all = raw.split(";").map((c) => c.trim()).filter(Boolean);
  const kept = all.filter((c) => !FOREIGN_HANDSHAKE_COOKIES.some((name) => c.startsWith(`${name}=`)));
  if (kept.length === all.length) return null;

  const headers = new Headers(request.headers);
  if (kept.length) headers.set("cookie", kept.join("; "));
  else headers.delete("cookie");
  return new NextRequest(request, { headers });
}

/**
 * Expire the foreign handshake cookies on this host and on the shared parent
 * domain. The host comes from the request headers: behind nginx in dev,
 * request.nextUrl.hostname is "localhost", which has no parent domain.
 */
export function expireForeignHandshakeCookies(response: Response, request: NextRequest): void {
  const forwarded = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const hostname = (forwarded.split(",")[0] ?? "").trim().replace(/:\d+$/, "");
  const labels = hostname.split(".");
  const parentDomain = labels.length >= 2 && !/^\d+$/.test(labels[labels.length - 1] ?? "")
    ? labels.slice(-2).join(".")
    : null;

  for (const name of FOREIGN_HANDSHAKE_COOKIES) {
    response.headers.append("set-cookie", `${name}=; Path=/; Max-Age=0`);
    if (parentDomain) {
      response.headers.append(
        "set-cookie",
        `${name}=; Path=/; Max-Age=0; Domain=.${parentDomain}; Secure; SameSite=Lax`,
      );
    }
  }
}
