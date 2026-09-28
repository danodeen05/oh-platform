/**
 * Fastify server options and the global rate limit (Task B1 fix round 1,
 * Task G3b).
 *
 * Railway (and nginx in dev) sits one proxy hop in front of the API. Without
 * trustProxy, req.ip is the proxy's address, so every client shared one
 * rate-limit bucket (e.g. 10 guest tokens per hour for ALL new guests).
 *
 * trustProxy: 1 trusts exactly one hop: req.ip is the address that proxy
 * appended to X-Forwarded-For (the rightmost entry), which a client cannot
 * forge. trustProxy: true would take the LEFTMOST entry, which the client
 * controls, and let anyone pick their own bucket. Same rule as
 * support/routes.js clientIpOf. req.protocol / req.hostname now honor
 * X-Forwarded-Proto / -Host; tenant resolution reads headers.host directly and
 * is unaffected.
 *
 * G3b (opening-day outage risk): in-store guests share the restaurant's
 * public IP (75 pods, status pages polling) and the web's server-side
 * fetches share Vercel's egress IPs, so 100 requests per minute per IP would
 * throttle both at opening. The global limit is now RATE_LIMIT_MAX per
 * RATE_LIMIT_WINDOW (defaults 600 per 1 minute), and a trusted
 * server-to-server call skips it: it carries the shared ADMIN_API_KEY in
 * the dedicated `x-oh-server-key` header (constant-time compare; never
 * trusted when the key is unset or empty). That header grants NOTHING else:
 * admin and service auth still read `x-admin-api-key` only. Per-route
 * limits (Chappy per identity, guest tokens, /plan/auth) are separate
 * `config.rateLimit` settings and are unchanged.
 */
import crypto from "node:crypto";

export const TRUSTED_PROXY_HOPS = 1;

export const FASTIFY_OPTIONS = Object.freeze({ logger: true, trustProxy: TRUSTED_PROXY_HOPS });

export const SERVER_KEY_HEADER = "x-oh-server-key";
export const DEFAULT_RATE_LIMIT_MAX = 600;
export const DEFAULT_RATE_LIMIT_WINDOW = "1 minute";

/** Key for @fastify/rate-limit: the real client IP (see above). */
export function rateLimitKey(req) {
  return req.ip || "unknown";
}

/**
 * The global limit from the environment. RATE_LIMIT_MAX must be a positive
 * integer; RATE_LIMIT_WINDOW is milliseconds ("60000") or an @fastify/rate-limit
 * duration string ("1 minute"). A bad value falls back to the default with a warning.
 */
export function globalRateLimitSettings(env = process.env, warn = console.warn) {
  let max = DEFAULT_RATE_LIMIT_MAX;
  const rawMax = env.RATE_LIMIT_MAX;
  if (rawMax !== undefined && rawMax !== "") {
    const n = Number(rawMax);
    if (Number.isInteger(n) && n > 0) max = n;
    else warn(`[rate-limit] RATE_LIMIT_MAX="${rawMax}" is not a positive integer; using ${DEFAULT_RATE_LIMIT_MAX}`);
  }
  let timeWindow = DEFAULT_RATE_LIMIT_WINDOW;
  const rawWindow = env.RATE_LIMIT_WINDOW;
  if (rawWindow !== undefined && rawWindow !== "") {
    const trimmed = String(rawWindow).trim();
    if (/^\d+$/.test(trimmed) && Number(trimmed) > 0) timeWindow = Number(trimmed);
    else if (/^\d+\s*(ms|milliseconds?|s|seconds?|m|mins?|minutes?|h|hours?)$/i.test(trimmed)) timeWindow = trimmed;
    else warn(`[rate-limit] RATE_LIMIT_WINDOW="${rawWindow}" is not understood; using ${DEFAULT_RATE_LIMIT_WINDOW}`);
  }
  return { max, timeWindow };
}

/** True only for a request carrying the non-empty ADMIN_API_KEY in `x-oh-server-key`. */
export function isTrustedServerCall(req, env = process.env) {
  const key = env.ADMIN_API_KEY;
  if (typeof key !== "string" || key.length === 0) return false;
  const header = req?.headers?.[SERVER_KEY_HEADER];
  if (typeof header !== "string" || header.length === 0) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(key);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** The full @fastify/rate-limit options for the global limit. */
export function globalRateLimitOptions(env = process.env, warn = console.warn) {
  const { max, timeWindow } = globalRateLimitSettings(env, warn);
  return {
    max,
    timeWindow,
    keyGenerator: (req) => rateLimitKey(req),
    errorResponseBuilder: (req, context) => ({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${context.after}`,
      statusCode: 429,
    }),
    // Health checks and trusted server-to-server calls skip the global limit.
    allowList: (req) => req.url === "/health" || isTrustedServerCall(req, env),
  };
}
