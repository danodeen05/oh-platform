/**
 * Fastify server options and the global rate-limit key (Task B1 fix round 1).
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
 */
export const TRUSTED_PROXY_HOPS = 1;

export const FASTIFY_OPTIONS = Object.freeze({ logger: true, trustProxy: TRUSTED_PROXY_HOPS });

/** Key for @fastify/rate-limit: the real client IP (see above). */
export function rateLimitKey(req) {
  return req.ip || "unknown";
}
