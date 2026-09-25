/**
 * Admin route guard for /admin/*.
 *
 * Three ways in:
 *  1. x-admin-api-key equal to ADMIN_API_KEY (server-to-server).
 *  2. Authorization: Bearer <Clerk session JWT>, verified against the Clerk
 *     instance that owns CLERK_SECRET_KEY (or, if set, CLERK_SECRET_KEY_DEV,
 *     the same application's development instance), whose user's primary
 *     email is on the ADMIN_EMAILS allowlist. The lookup is cached per user
 *     for a few minutes because the dashboard makes many small calls.
 *  3. Development only (NODE_ENV !== production) with no ADMIN_API_KEY set:
 *     everything is allowed, matching the pre-existing local workflow.
 *
 * Before 2026-09-25 any Bearer value was accepted in production.
 */

import { createClerkClient, verifyToken as clerkVerifyToken } from "@clerk/backend";

export const DEFAULT_ADMIN_EMAILS = ["danodeen@me.com", "danodeen@gmail.com"];
const CACHE_MS = 5 * 60 * 1000;

export function parseAdminEmails(value) {
  const list = (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ADMIN_EMAILS;
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createAdminAuth(options = {}) {
  const env = options.env || process.env;
  const secretKeys = [env.CLERK_SECRET_KEY, env.CLERK_SECRET_KEY_DEV].filter((k) => typeof k === "string" && k.length > 0);
  const apiKey = env.ADMIN_API_KEY || "";
  const isProduction = env.NODE_ENV === "production";
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  const now = options.now || (() => Date.now());
  const log = options.log || (() => {});

  const clients = options.getUser ? new Map() : new Map(secretKeys.map((k) => [k, createClerkClient({ secretKey: k })]));
  const verifyToken = options.verifyToken || ((token, secretKey) => clerkVerifyToken(token, { secretKey }));
  const getUser = options.getUser || ((userId, secretKey) => clients.get(secretKey).users.getUser(userId));

  const cache = new Map();

  /** Try each configured instance; return the payload and the key that verified it. */
  async function verifyAgainstAny(token) {
    let lastError = null;
    for (const secretKey of secretKeys) {
      try {
        const payload = await verifyToken(token, secretKey);
        return { payload, secretKey };
      } catch (err) {
        lastError = err;
      }
    }
    log("admin bearer rejected", lastError?.message);
    return null;
  }

  async function isAdminBearer(token) {
    if (secretKeys.length === 0 || !token) return false;
    const verified = await verifyAgainstAny(token);
    if (!verified) return false;
    const userId = verified.payload?.sub;
    if (!userId) return false;
    const cacheKey = `${verified.secretKey.slice(-6)}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.exp > now()) return cached.ok;

    let ok = false;
    try {
      const user = await getUser(userId, verified.secretKey);
      const primary = (user.emailAddresses || []).find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
      ok = typeof primary === "string" && adminEmails.includes(primary.toLowerCase());
    } catch (err) {
      log("admin user lookup failed", err?.message);
      ok = false;
    }
    if (cache.size > 1000) cache.clear();
    cache.set(cacheKey, { ok, exp: now() + CACHE_MS });
    return ok;
  }

  async function requireAdminAuth(req, reply) {
    if (!isProduction && !apiKey) return;

    const headerKey = req.headers["x-admin-api-key"];
    if (apiKey && timingSafeEqual(typeof headerKey === "string" ? headerKey : "", apiKey)) return;

    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      if (await isAdminBearer(authHeader.slice(7).trim())) return;
    }

    return reply.code(401).send({ error: "Unauthorized - Admin authentication required" });
  }

  return { requireAdminAuth, isAdminBearer, adminEmails };
}
