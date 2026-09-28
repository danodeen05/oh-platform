/**
 * Verified customer identity for member-scoped routes.
 *
 * Before 2026-09-27 the API trusted client-supplied user ids: anyone who knew
 * an email could call GET /users/by-email/:email, learn the database id and
 * then read /users/:id/*. Identity now comes only from credentials the server
 * can check:
 *
 *  - Authorization: Bearer <Clerk session JWT>, verified against the Clerk
 *    instance that owns CLERK_SECRET_KEY (plus CLERK_SECRET_KEY_DEV, but only
 *    outside production), like auth/admin.js. Site users link to Clerk by EMAIL (the DB User has no
 *    Clerk id), so the resolver is: verified JWT -> Clerk user's verified
 *    primary email -> prisma.user by email. Both lookups are cached 5 minutes.
 *  - A guest token "g1.<random>.<hmac>" (HMAC-SHA256 with CHAPPY_GUEST_SECRET,
 *    30-day expiry encoded in <random>), sent as a Bearer or x-guest-token.
 *    Chappy issues these at POST /chappy/guest-token and reads them only from
 *    the x-chappy-guest header (resolveChappyWebIdentity below).
 *  - x-admin-api-key equal to ADMIN_API_KEY counts as a trusted service call
 *    for requireSelf/requireEmail (server-to-server).
 *
 * Anything else is anonymous. Client-sent userId values are never identity.
 */

import crypto from "node:crypto";
import { createClerkClient, verifyToken as clerkVerifyToken } from "@clerk/backend";

const CACHE_MS = 5 * 60 * 1000;
export const GUEST_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const LINK_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

/** Route prefixes whose requests get req.customer resolved up front. */
export const CUSTOMER_ROUTE_PREFIXES = ["/users", "/orders", "/membership", "/support/cases", "/chappy"];

const ANONYMOUS = Object.freeze({ kind: "anonymous" });
const kPending = Symbol("customerIdentity");

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmac(key, message) {
  return crypto.createHmac("sha256", key).update(message).digest("base64url");
}

function bearerOf(req) {
  const h = req?.headers?.authorization;
  if (typeof h !== "string" || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

export function createCustomerAuth(options = {}) {
  const env = options.env || process.env;
  const isProduction = env.NODE_ENV === "production";
  // Identity is by email, so a token from the development Clerk instance (where
  // anyone can register any address) must never map to a production member.
  const secretKeys = [env.CLERK_SECRET_KEY, isProduction ? null : env.CLERK_SECRET_KEY_DEV].filter((k) => typeof k === "string" && k.length > 0);
  const apiKey = env.ADMIN_API_KEY || "";
  const guestSecret = env.CHAPPY_GUEST_SECRET || "";
  /** Misconfigurations the server should announce at startup. */
  const warnings = [];
  if (isProduction && !guestSecret) {
    warnings.push("CHAPPY_GUEST_SECRET is not set: Chappy guest tokens and wallet pass links are disabled.");
  }
  if (isProduction && env.CLERK_SECRET_KEY_DEV) {
    warnings.push("CLERK_SECRET_KEY_DEV is set but ignored for customer identity in production.");
  }
  // Signed links use a key derived from the guest secret so the two token kinds can never be swapped.
  const linkKey = guestSecret ? hmac(guestSecret, "oh-signed-link-key-v1") : "";
  const now = options.now || (() => Date.now());
  const log = options.log || (() => {});
  const prisma = options.prisma;

  const clients = options.getUser ? new Map() : new Map(secretKeys.map((k) => [k, createClerkClient({ secretKey: k })]));
  const verifyToken = options.verifyToken || ((token, secretKey) => clerkVerifyToken(token, { secretKey }));
  const getUser = options.getUser || ((userId, secretKey) => clients.get(secretKey).users.getUser(userId));

  const emailCache = new Map(); // "<key suffix>:<clerk sub>" -> { email, exp }
  const userIdCache = new Map(); // email -> { userId, exp } (positive hits only)

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
    log("customer bearer rejected", lastError?.message);
    return null;
  }

  async function emailFor(sub, secretKey) {
    const key = `${secretKey.slice(-6)}:${sub}`;
    const cached = emailCache.get(key);
    if (cached && cached.exp > now()) return cached.email;
    let email = null;
    try {
      const user = await getUser(sub, secretKey);
      const primary = (user.emailAddresses || []).find((e) => e.id === user.primaryEmailAddressId);
      const status = primary?.verification?.status;
      if (primary && typeof primary.emailAddress === "string" && status === "verified") {
        email = primary.emailAddress.trim().toLowerCase();
      }
    } catch (err) {
      log("customer user lookup failed", err?.message);
      return null; // do not cache a Clerk outage
    }
    if (emailCache.size > 5000) emailCache.clear();
    emailCache.set(key, { email, exp: now() + CACHE_MS });
    return email;
  }

  async function userIdFor(email) {
    const cached = userIdCache.get(email);
    if (cached && cached.exp > now()) return cached.userId;
    if (!prisma) return null;
    const row = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (!row) return null; // not cached: POST /users may create it a moment later
    if (userIdCache.size > 5000) userIdCache.clear();
    userIdCache.set(email, { userId: row.id, exp: now() + CACHE_MS });
    return row.id;
  }

  function verifyGuestToken(token) {
    if (!guestSecret || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "g1" || !parts[1]) return null;
    if (!safeEqual(parts[2], hmac(guestSecret, `g1.${parts[1]}`))) return null;
    const issuedAt = parseInt(parts[1].split("_")[0], 36);
    if (!Number.isFinite(issuedAt)) return null;
    const t = now();
    if (issuedAt > t + CLOCK_SKEW_MS || t - issuedAt > GUEST_TOKEN_TTL_MS) return null;
    return { kind: "guest", guestKey: parts[1] };
  }

  function issueGuestToken() {
    if (!guestSecret) throw new Error("CHAPPY_GUEST_SECRET is not configured");
    const random = `${now().toString(36)}_${crypto.randomBytes(18).toString("base64url")}`;
    return `g1.${random}.${hmac(guestSecret, `g1.${random}`)}`;
  }

  async function identify(req) {
    const token = bearerOf(req);
    if (token && token.startsWith("g1.")) return verifyGuestToken(token) || ANONYMOUS;
    if (token && secretKeys.length > 0) {
      const verified = await verifyAgainstAny(token);
      const sub = verified?.payload?.sub;
      if (sub) {
        const email = await emailFor(sub, verified.secretKey);
        if (email) return { kind: "user", userId: await userIdFor(email), email };
      }
    }
    const guestHeader = req?.headers?.["x-guest-token"];
    if (typeof guestHeader === "string") return verifyGuestToken(guestHeader) || ANONYMOUS;
    return ANONYMOUS;
  }

  /** Resolve (and memoise on the request) who is calling. Never throws. */
  async function resolve(req) {
    if (!req[kPending]) {
      req[kPending] = identify(req)
        .catch((err) => {
          log("customer identity failed", err?.message);
          return ANONYMOUS;
        })
        .then((who) => {
          req.customer = who;
          return who;
        });
    }
    return req[kPending];
  }

  function isServiceCall(req) {
    const key = req?.headers?.["x-admin-api-key"];
    return Boolean(apiKey) && safeEqual(typeof key === "string" ? key : "", apiKey);
  }

  /** A signed-in customer with a database row, or null after sending 401/403. */
  async function requireUser(req, reply) {
    const who = await resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    if (!who.userId) {
      reply.code(403).send({ error: "No account for this sign-in yet" });
      return null;
    }
    return who;
  }

  /** The caller must be database user `id` (or a trusted service), else 401/403. */
  async function requireSelf(req, reply, id) {
    if (isServiceCall(req)) return { kind: "service" };
    const who = await resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    if (!id || !who.userId || who.userId !== id) {
      reply.code(403).send({ error: "Forbidden" });
      return null;
    }
    return who;
  }

  /** The caller's verified email must equal `email` (case-insensitive). */
  async function requireEmail(req, reply, email) {
    if (isServiceCall(req)) return { kind: "service" };
    const who = await resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    const wanted = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!wanted || who.email !== wanted) {
      reply.code(403).send({ error: "Forbidden" });
      return null;
    }
    return who;
  }

  /** Short-lived HMAC link for requests that cannot carry a header (downloads, wallet passes). */
  function signLink(purpose, subject, ttlMs = LINK_TTL_MS) {
    if (!linkKey) throw new Error("CHAPPY_GUEST_SECRET is not configured");
    const exp = String(now() + ttlMs);
    return { exp, sig: hmac(linkKey, `link.v1.${purpose}.${subject}.${exp}`) };
  }

  function verifyLink(purpose, subject, exp, sig) {
    if (!linkKey || !subject || typeof exp !== "string" || typeof sig !== "string") return false;
    if (!/^\d{1,16}$/.test(exp) || Number(exp) < now()) return false;
    return safeEqual(sig, hmac(linkKey, `link.v1.${purpose}.${subject}.${exp}`));
  }

  /** Fastify preHandler: sets req.customer. Never rejects on its own. */
  async function resolveCustomer(req) {
    await resolve(req);
  }

  /**
   * POST /users gate. Returns the { email, phone } the upsert may use, or null
   * after sending 401/403. Customers may only upsert their own verified email
   * and never look up by a client phone; trusted services keep email/phone.
   */
  async function signupFields(req, reply) {
    const body = req.body || {};
    if (isServiceCall(req)) return { email: body.email, phone: body.phone };
    const who = await resolve(req);
    if (who.kind !== "user") {
      reply.code(401).send({ error: "Sign in required" });
      return null;
    }
    if (typeof body.email !== "string" || body.email.trim().toLowerCase() !== who.email) {
      reply.code(403).send({ error: "Email must match your signed-in account" });
      return null;
    }
    return { email: body.email.trim(), phone: undefined };
  }

  return { resolve, issueGuestToken, verifyGuestToken, requireUser, requireSelf, requireEmail, signLink, verifyLink, isServiceCall, resolveCustomer, signupFields, warnings };
}

/**
 * The member an order may be attributed to: only a verified signed-in caller.
 * Anonymous callers, guests and kiosk devices get null whatever the body says.
 */
export function orderOwnerId(who) {
  return who && who.kind === "user" && who.userId ? who.userId : null;
}

/**
 * Who a web Chappy request is for (Task B1). A member comes only from the
 * verified session (a database user id); a guest only from a SIGNED guest
 * token (POST /chappy/guest-token, sent as x-chappy-guest), whose random part
 * becomes the conversation key. Raw guestId/sessionId/userId values from the
 * client are never consulted, so one guest cannot claim another's
 * conversation. Returns null when the request cannot be identified: callers
 * answer 401 (there is no shared fallback conversation).
 */
export function resolveChappyWebIdentity({ who, guestToken, verifyGuestToken }) {
  const userId = orderOwnerId(who);
  if (userId) return { kind: "member", userId, identifier: userId };
  const guest = typeof guestToken === "string" && guestToken ? verifyGuestToken(guestToken) : null;
  if (guest && guest.kind === "guest" && guest.guestKey) {
    return { kind: "guest", guestKey: guest.guestKey, identifier: `guest:${guest.guestKey}` };
  }
  return null;
}

const USER_ID_ROUTE = /^\/users\/:(id|userId)(\/|$)/;
const WALLET_DOWNLOAD_ROUTE = /\/wallet\/(apple|google)$/;

/**
 * Wire identity into a Fastify app. Call before routes are declared.
 *  - preHandler: resolves req.customer for CUSTOMER_ROUTE_PREFIXES.
 *  - onRoute: every /users/:id/* and /users/:userId/* route requires the
 *    caller to be that user (requireSelf). Wallet pass downloads also accept
 *    a signed link (?exp=&sig=, purpose "wallet") because they are opened as
 *    plain navigations that cannot carry an Authorization header.
 */
export function registerCustomerIdentity(app, auth, { prefixes = CUSTOMER_ROUTE_PREFIXES } = {}) {
  app.addHook("preHandler", async (req) => {
    const url = req.routeOptions?.url || req.url || "";
    if (prefixes.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`))) {
      await auth.resolveCustomer(req);
    }
  });

  app.addHook("onRoute", (route) => {
    const match = USER_ID_ROUTE.exec(route.url || "");
    if (!match) return;
    const param = match[1];
    const walletDownload = WALLET_DOWNLOAD_ROUTE.test(route.url);
    const guard = async (req, reply) => {
      const id = req.params?.[param];
      if (walletDownload && auth.verifyLink("wallet", id, req.query?.exp, req.query?.sig)) return;
      if (!(await auth.requireSelf(req, reply, id))) return reply;
    };
    const existing = route.preHandler ? (Array.isArray(route.preHandler) ? route.preHandler : [route.preHandler]) : [];
    route.preHandler = [guard, ...existing];
  });
}
