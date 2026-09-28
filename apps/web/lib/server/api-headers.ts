/**
 * Task G3b: headers for SERVER-SIDE calls from this Next.js app to the API.
 *
 * The API's global rate limit is per client IP, and Vercel's server-side
 * fetches share egress IPs, so they carry the shared ADMIN_API_KEY in the
 * dedicated `x-oh-server-key` header, which makes the API skip the global
 * limit for them (packages/api/src/http-config.js). The header grants nothing
 * else.
 *
 * SERVER ONLY. Import it from server components, route handlers and
 * server-only libs, never from a "use client" file (a test enforces that).
 * ADMIN_API_KEY has no NEXT_PUBLIC_ prefix, so Next never inlines it into a
 * browser bundle; in the browser this returns only the extra headers.
 */
export const SERVER_KEY_HEADER = "x-oh-server-key";

export function serverApiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (typeof window !== "undefined") return { ...extra };
  const key = process.env.ADMIN_API_KEY;
  return key ? { ...extra, [SERVER_KEY_HEADER]: key } : { ...extra };
}
