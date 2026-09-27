/**
 * Admin route guard for /admin/*.
 *
 * Three ways in, each setting req.adminRole:
 *  1. x-admin-api-key equal to ADMIN_API_KEY (server-to-server) sets owner.
 *  2. Authorization: Bearer <Clerk session JWT>, verified against the Clerk
 *     instance that owns CLERK_SECRET_KEY (or, if set, CLERK_SECRET_KEY_DEV,
 *     the same application's development instance). An allowlisted primary
 *     email (ADMIN_EMAILS) is always owner; otherwise the role comes from
 *     the user's Clerk publicMetadata.adminRole. The lookup is cached per
 *     user for a few minutes because the dashboard makes many small calls.
 *  3. Development only (NODE_ENV !== production) with no ADMIN_API_KEY set:
 *     everything is allowed, matching the pre-existing local workflow; the
 *     role is DEV_ADMIN_ROLE when valid, otherwise owner.
 *
 * Before 2026-09-25 any Bearer value was accepted in production.
 */

import { createClerkClient, verifyToken as clerkVerifyToken } from "@clerk/backend";

export const DEFAULT_ADMIN_EMAILS = ["danodeen@me.com", "danodeen@gmail.com"];
export const ADMIN_ROLES = Object.freeze(["owner", "manager", "station"]);
const CACHE_MS = 5 * 60 * 1000;

export function parseAdminEmails(value) {
  const list = (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ADMIN_EMAILS;
}

/** Allowlisted email = owner; otherwise Clerk publicMetadata.adminRole if it is a known role. */
export function roleFor({ email, metadata, adminEmails }) {
  if (typeof email === "string" && adminEmails.includes(email.toLowerCase())) return "owner";
  const role = metadata?.adminRole;
  return ADMIN_ROLES.includes(role) ? role : null;
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

  async function resolveBearer(token) {
    if (secretKeys.length === 0 || !token) return null;
    const verified = await verifyAgainstAny(token);
    if (!verified) return null;
    const userId = verified.payload?.sub;
    if (!userId) return null;
    const cacheKey = `${verified.secretKey.slice(-6)}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.exp > now()) return cached.role ? { role: cached.role, userId } : null;

    let role = null;
    try {
      const user = await getUser(userId, verified.secretKey);
      const primary = (user.emailAddresses || []).find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
      role = roleFor({ email: primary, metadata: user.publicMetadata, adminEmails });
    } catch (err) {
      // Fail closed for this request, but don't cache: a Clerk blip must not
      // lock station tablets out for the whole cache window.
      log("admin user lookup failed", err?.message);
      return null;
    }
    if (cache.size > 1000) cache.clear();
    cache.set(cacheKey, { role, exp: now() + CACHE_MS });
    return role ? { role, userId } : null;
  }

  async function isAdminBearer(token) {
    return Boolean(await resolveBearer(token));
  }

  function forget(userId) {
    for (const key of cache.keys()) if (key.endsWith(`:${userId}`)) cache.delete(key);
  }

  const devRole = ADMIN_ROLES.includes(env.DEV_ADMIN_ROLE) ? env.DEV_ADMIN_ROLE : "owner";

  async function requireAdminAuth(req, reply) {
    if (!isProduction && !apiKey) {
      req.adminRole = devRole;
      return;
    }
    const headerKey = req.headers["x-admin-api-key"];
    if (apiKey && timingSafeEqual(typeof headerKey === "string" ? headerKey : "", apiKey)) {
      req.adminRole = "owner";
      return;
    }
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const who = await resolveBearer(authHeader.slice(7).trim());
      if (who) {
        req.adminRole = who.role;
        req.adminUserId = who.userId;
        return;
      }
    }
    return reply.code(401).send({ error: "Unauthorized - Admin authentication required" });
  }

  function requireRole(...roles) {
    return async function requireRoleHandler(req, reply) {
      if (!roles.includes(req.adminRole)) return reply.code(403).send({ error: "Forbidden" });
    };
  }

  return { requireAdminAuth, requireRole, resolveBearer, isAdminBearer, forget, adminEmails };
}
