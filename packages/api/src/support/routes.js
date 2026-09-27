/**
 * Support cases (Task A9).
 *
 *   POST /support/cases                     Public (contact form, Chappy). The customer
 *                                           comes from customerAuth.resolve, never the body.
 *   GET  /admin/support/cases?status=       Staff: newest first.
 *   POST /admin/support/cases/:id/resolve   Staff: {action: "credit" | "full_refund" | "decline" | "close"}
 *
 * Money rules (owner's): staff give store credit (ADMIN lot, 1..50000 cents,
 * no goodwill caps) or refund the ENTIRE order to the card (support/refund.js,
 * no amount field ever; a body with amountCents is 400
 * PARTIAL_REFUND_NOT_ALLOWED). Chappy's capped goodwill is support/caps.js.
 * "close" moves no money (resolution INFO, a reason required): it closes a
 * case that has nothing left to do, e.g. one whose order another case already
 * refunded (Task A9b).
 *
 * /admin/* is guarded by the app-wide admin path hook in index.js at the
 * STAFF default (adminPathRoles); full_refund additionally requires the
 * owner role (requireOwner, wired to requireRole("owner") in index.js).
 */
import crypto from "node:crypto";
import { grantCreditInTx } from "../membership/credits.js";
import { fullRefundCase, SupportError, REFUND_LEASE_MS } from "./refund.js";

export const SUPPORT_CASE_TYPES = Object.freeze(["POD_ISSUE", "ORDER_ISSUE", "REFUND_REQUEST", "GENERAL", "CONTACT"]);
export const SUPPORT_CASE_STATUSES = Object.freeze(["OPEN", "RESOLVED", "DECLINED"]);
export const SUPPORT_LOCALES = Object.freeze(["en", "es", "zh-CN", "zh-TW"]);
export const STAFF_CREDIT_MAX_CENTS = 50000;
export const SMS_AMOUNT_THRESHOLD_CENTS = 2000;
export const CASE_RATE_LIMIT = Object.freeze({ max: 5, windowMs: 60 * 60 * 1000 });
const SUMMARY_MAX = 2000;
const TRANSCRIPT_MAX_CHARS = 60000;
const REASON_MAX = 1000;
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,255}\.[A-Za-z]{2,}$/;

/** SUPPORT_NOTIFY: off | log | live (default live). Anything unrecognised is treated as log, never live. */
export function notifyMode(env = process.env) {
  const raw = env.SUPPORT_NOTIFY;
  if (raw === undefined || raw === null || raw === "") return "live";
  const mode = String(raw).trim().toLowerCase();
  return mode === "off" || mode === "live" ? mode : "log";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;

/**
 * Tells the owner about a case: an SMS (sendSMS to ADMIN_PHONE_NUMBER) when
 * it is urgent or amountCents >= 2000, and always an email (sendGraphMail to
 * PLAN_NOTIFY_EMAIL, else OWNER_EMAIL). `warnings` (e.g. a gift card a refund
 * could not restore) mark the email "needs attention" and are listed in it.
 * Honors SUPPORT_NOTIFY. Never throws.
 * Returns { sms, email }, each "sent" | "logged" | "off" | "skipped" | "failed".
 */
export async function notifyCase(deps, supportCase, { urgent = false, warnings = [] } = {}) {
  const env = deps.env || process.env;
  const log = deps.log || ((line) => console.log(line));
  const mode = notifyMode(env);
  const c = supportCase || {};
  const wantSms = Boolean(urgent) || (Number.isInteger(c.amountCents) && c.amountCents >= SMS_AMOUNT_THRESHOLD_CENTS);
  const result = { sms: "skipped", email: "skipped" };
  if (mode === "off") return { sms: "off", email: "off" };

  const summary = String(c.summary || "").replace(/\s+/g, " ").trim();
  const money = Number.isInteger(c.amountCents) ? ` (${dollars(c.amountCents)})` : "";
  const smsBody = `Oh! support${urgent ? " URGENT" : ""}: ${c.type || "CASE"}${money}. ${summary.slice(0, 120)}${summary.length > 120 ? "..." : ""} Case ${c.id}`;
  const attention = Array.isArray(warnings) && warnings.length > 0;
  const subject = `Support case${urgent ? " (urgent)" : ""}${attention ? " (needs attention)" : ""}: ${c.type || "CASE"}${money}`;
  const contact = c.contact && typeof c.contact === "object" ? c.contact : {};
  const html = [
    `<p><strong>${escapeHtml(subject)}</strong></p>`,
    `<p>${escapeHtml(c.summary || "")}</p>`,
    attention ? `<p><strong>Needs attention:</strong> ${escapeHtml(warnings.join(", "))}</p>` : "",
    `<p>Case ${escapeHtml(c.id)}${c.orderId ? `, order ${escapeHtml(c.orderId)}` : ""}${c.userId ? `, member ${escapeHtml(c.userId)}` : ""}${c.locale ? `, locale ${escapeHtml(c.locale)}` : ""}</p>`,
    contact.email || contact.phone || contact.name
      ? `<p>Contact: ${escapeHtml([contact.name, contact.email, contact.phone].filter(Boolean).join(", "))}</p>`
      : "",
  ].join("");
  const to = env.PLAN_NOTIFY_EMAIL || env.OWNER_EMAIL || null;
  const phone = env.ADMIN_PHONE_NUMBER || null;

  if (wantSms) {
    if (!phone) result.sms = "skipped";
    else if (mode === "log") {
      log(`[support] SUPPORT_NOTIFY=log: would text ${phone}: ${smsBody}`);
      result.sms = "logged";
    } else {
      try {
        const r = await deps.sendSMS({ to: phone, body: smsBody });
        result.sms = r && r.success === false ? "failed" : "sent";
      } catch (err) {
        console.error(`[support] case ${c.id} SMS failed:`, err?.message || err);
        result.sms = "failed";
      }
    }
  }

  if (!to) result.email = "skipped";
  else if (mode === "log") {
    log(`[support] SUPPORT_NOTIFY=log: would email ${to}: ${subject}`);
    result.email = "logged";
  } else {
    try {
      const r = await deps.sendGraphMail({ to: [to], subject, html });
      result.email = r && r.success === false ? "failed" : "sent";
    } catch (err) {
      console.error(`[support] case ${c.id} email failed:`, err?.message || err);
      result.email = "failed";
    }
  }
  return result;
}

/**
 * The caller's address for rate limiting. Behind Railway's edge (and nginx in
 * dev) req.ip is the proxy, so every anonymous caller would share one bucket.
 * The proxy APPENDS the address it saw to X-Forwarded-For, so the rightmost
 * entry is the one a client cannot forge (anything it sends lands to the left).
 */
export function clientIpOf(req) {
  const xff = req.headers?.["x-forwarded-for"];
  const hops = typeof xff === "string" ? xff.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return hops.length ? hops[hops.length - 1] : req.ip || "unknown";
}

/** Fixed-window counter per key; prunes itself. */
function createRateLimiter({ max, windowMs }, now) {
  const hits = new Map();
  return function take(key) {
    const t = now().getTime();
    if (hits.size > 10000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    if (cur.count >= max) return false;
    cur.count += 1;
    return true;
  };
}

/** Runs fn with no other fn for the same key running in this process. */
function createKeyedLock() {
  const tails = new Map();
  return async function withKey(key, fn) {
    const prev = tails.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.then(() => undefined, () => undefined);
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}

class InputError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function cleanContact(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new InputError("INVALID_CONTACT", "contact must be an object with an email or phone.");
  const out = {};
  if (raw.email !== undefined && raw.email !== null && raw.email !== "") {
    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    if (email.length > 254 || !EMAIL_RE.test(email)) throw new InputError("INVALID_CONTACT", "That email address does not look right.");
    out.email = email;
  }
  if (raw.phone !== undefined && raw.phone !== null && raw.phone !== "") {
    const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
    const digits = phone.replace(/\D/g, "");
    if (phone.length > 32 || digits.length < 7 || digits.length > 15 || /[^\d\s()+.-]/.test(phone)) throw new InputError("INVALID_CONTACT", "That phone number does not look right.");
    out.phone = phone;
  }
  if (typeof raw.name === "string" && raw.name.trim()) out.name = raw.name.trim().slice(0, 100);
  if (!out.email && !out.phone) throw new InputError("CONTACT_REQUIRED", "An email or phone number is required.");
  return out;
}

/**
 * Validates and stores a case. `who` is the verified caller (customerAuth);
 * nothing in `body` can set the member. Throws InputError.
 */
export async function createSupportCase(prisma, { who, body }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("INVALID_BODY", "Expected a JSON object.");
  const { type, summary, orderId, transcript, locale } = body;
  if (!SUPPORT_CASE_TYPES.includes(type)) throw new InputError("INVALID_TYPE", `type must be one of ${SUPPORT_CASE_TYPES.join(", ")}.`);
  const text = typeof summary === "string" ? summary.trim() : "";
  if (!text || text.length > SUMMARY_MAX) throw new InputError("INVALID_SUMMARY", `summary must be 1 to ${SUMMARY_MAX} characters.`);
  if (locale !== undefined && locale !== null && !SUPPORT_LOCALES.includes(locale)) throw new InputError("INVALID_LOCALE", "Unsupported locale.");
  if (orderId !== undefined && orderId !== null && (typeof orderId !== "string" || !orderId || orderId.length > 64)) throw new InputError("INVALID_ORDER", "orderId must be a string.");
  let storedTranscript = null;
  if (transcript !== undefined && transcript !== null) {
    let size;
    try {
      size = JSON.stringify(transcript).length;
    } catch {
      throw new InputError("INVALID_TRANSCRIPT", "transcript must be JSON.");
    }
    if (size > TRANSCRIPT_MAX_CHARS) throw new InputError("TRANSCRIPT_TOO_LARGE", "transcript is too large.");
    storedTranscript = transcript;
  }

  const userId = who && who.kind === "user" && who.userId ? who.userId : null;
  // Members are reachable through their account; everyone else must leave a way back.
  const contact = userId ? (body.contact === undefined || body.contact === null ? null : cleanContact(body.contact)) : cleanContact(body.contact);
  if (!userId && !contact) throw new InputError("CONTACT_REQUIRED", "An email or phone number is required.");

  let amountCents = null;
  if (orderId) {
    const order = userId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    // Same answer for "not yours" and "no such order": no order enumeration.
    if (!order || order.userId !== userId) throw new InputError("ORDER_NOT_OWNED", "That order is not on your account.", 403);
    amountCents = Number.isInteger(order.totalCents) ? order.totalCents : null;
  }

  return prisma.supportCase.create({
    data: {
      type,
      status: "OPEN",
      summary: text,
      userId,
      orderId: orderId || null,
      contact,
      transcript: storedTranscript,
      locale: locale || null,
      amountCents,
    },
  });
}

/**
 * @param {import("fastify").FastifyInstance} app
 * @param {{
 *   prisma: any, stripe: any, customerAuth: { resolve: Function, isServiceCall: Function },
 *   sendSMS: Function, sendGraphMail: Function, env?: object, now?: () => Date,
 *   requireAdminAuth?: Function, requireOwner?: Function, resolvedByOf?: (req) => string,
 *   clientIpOf?: (req) => string, ipSalt?: string, log?: Function,
 * }} deps
 */
export async function registerSupportRoutes(app, deps) {
  const { prisma, stripe, customerAuth } = deps;
  const env = deps.env || process.env;
  const now = deps.now || (() => new Date());
  const log = deps.log || ((line) => console.log(line));
  const notifyDeps = { sendSMS: deps.sendSMS, sendGraphMail: deps.sendGraphMail, env, log };
  const take = createRateLimiter(CASE_RATE_LIMIT, now);
  const withCaseLock = createKeyedLock();
  const ipOf = deps.clientIpOf || clientIpOf;
  const ipSalt = deps.ipSalt || env.CHAPPY_GUEST_SECRET || crypto.randomBytes(16).toString("hex");
  const adminPre = deps.requireAdminAuth ? { preHandler: deps.requireAdminAuth } : {};
  // Owner-only for a full card refund (Task A9b): requireRole("owner") from
  // createAdminAuth(), wired in index.js. Falls open only when nothing is
  // injected (e.g. a test that doesn't care about role checks).
  const requireOwner = deps.requireOwner || (async () => {});
  // Who resolved it: the verified admin identity requireAdminAuth/requireRole
  // attach to the request (see auth/admin.js: req.adminUserId, a Clerk user
  // id; there is no email on req). x-admin-api-key service callers record
  // "service", and the pre-roles dev-bypass path (neither set) records "admin".
  const resolvedByOf = deps.resolvedByOf || ((req) => req.adminUserId || (req.headers["x-admin-api-key"] ? "service" : "admin"));

  app.post("/support/cases", async (req, reply) => {
    const body = req.body;
    const who = await customerAuth.resolve(req);
    const service = customerAuth.isServiceCall(req);
    if (!service) {
      const key = who.kind === "user" && who.userId ? `u:${who.userId}` : who.kind === "guest" ? `g:${who.guestKey}` : `ip:${crypto.createHmac("sha256", ipSalt).update(String(ipOf(req))).digest("base64url")}`;
      if (!take(key)) return reply.code(429).send({ error: "Too many requests. Try again later.", code: "RATE_LIMITED" });
    }
    // Honeypot: bots fill every field. Looks like success, stores nothing.
    if (body && typeof body === "object" && typeof body.website === "string" && body.website.trim()) {
      return reply.send({ ok: true, caseId: `c${crypto.randomBytes(12).toString("hex").slice(0, 24)}` });
    }
    let supportCase;
    try {
      supportCase = await createSupportCase(prisma, { who, body });
    } catch (err) {
      if (err instanceof InputError) return reply.code(err.status).send({ error: err.message, code: err.code });
      throw err;
    }
    // Only a trusted server-side caller (Chappy's backend) may mark a case urgent.
    const urgent = service && body.urgent === true;
    try {
      await notifyCase(notifyDeps, supportCase, { urgent });
    } catch (err) {
      console.error(`[support] notify failed for case ${supportCase.id}:`, err?.message || err);
    }
    return reply.send({ ok: true, caseId: supportCase.id });
  });

  app.get("/admin/support/cases", adminPre, async (req, reply) => {
    const status = req.query?.status;
    if (status !== undefined && status !== "" && !SUPPORT_CASE_STATUSES.includes(status)) {
      return reply.code(400).send({ error: `status must be one of ${SUPPORT_CASE_STATUSES.join(", ")}`, code: "INVALID_STATUS" });
    }
    const cases = await prisma.supportCase.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 });
    return { cases };
  });

  app.post("/admin/support/cases/:id/resolve", adminPre, async (req, reply) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const { action } = body;
    if (!["credit", "full_refund", "decline", "close"].includes(action)) {
      return reply.code(400).send({ error: 'action must be "credit", "full_refund", "decline" or "close"', code: "INVALID_ACTION" });
    }
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, REASON_MAX) : null;

    if (action === "full_refund") {
      // Never a partial card refund: any amount in the request is refused outright.
      if (Object.prototype.hasOwnProperty.call(body, "amountCents") || Object.prototype.hasOwnProperty.call(body, "amount")) {
        return reply.code(400).send({ error: "Card refunds are for the full order only. Use store credit for a partial amount.", code: "PARTIAL_REFUND_NOT_ALLOWED" });
      }
      await requireOwner(req, reply);
      if (reply.sent) return reply;
    }
    if (action === "credit") {
      const a = body.amountCents;
      if (!Number.isInteger(a) || a <= 0 || a > STAFF_CREDIT_MAX_CENTS) {
        return reply.code(400).send({ error: `amountCents must be a whole number from 1 to ${STAFF_CREDIT_MAX_CENTS}.`, code: "INVALID_AMOUNT" });
      }
    }
    if ((action === "decline" || action === "close") && !reason) {
      return reply.code(400).send({ error: `A reason is required to ${action}.`, code: "REASON_REQUIRED" });
    }

    const id = req.params.id;
    const REFUND_IN_PROGRESS = { status: 409, body: { error: "A card refund for this case is in progress. Retry the full refund, or wait.", code: "REFUND_IN_PROGRESS" } };
    const resolvedBy = resolvedByOf(req);
    const t = now();
    // A fresh full_refund pending claim blocks every other action (only a
    // full_refund retry may touch the case). A STALE one (the claimant
    // crashed or gave up, older than the lease) no longer blocks decline or
    // close: staff can still close the case out (Task A9b item 5).
    const staleFullRefundClaim = (sc) =>
      sc.resolution === "FULL_REFUND" && (!sc.resolvedAt || t.getTime() - new Date(sc.resolvedAt).getTime() >= REFUND_LEASE_MS);
    const result = await withCaseLock(id, async () => {
      const supportCase = await prisma.supportCase.findUnique({ where: { id } });
      if (!supportCase) return { status: 404, body: { error: "Case not found", code: "NOT_FOUND" } };
      if (supportCase.status !== "OPEN") return { status: 200, body: { ok: true, alreadyResolved: true, case: supportCase } };
      if (supportCase.resolution && action !== "full_refund" && !((action === "decline" || action === "close") && staleFullRefundClaim(supportCase))) {
        return REFUND_IN_PROGRESS;
      }

      if (action === "decline" || action === "close") {
        const claim = await prisma.supportCase.updateMany({
          where: { id, status: "OPEN", OR: [{ resolution: null }, { resolution: "FULL_REFUND", resolvedAt: { lt: new Date(t.getTime() - REFUND_LEASE_MS) } }] },
          data:
            action === "decline"
              ? { status: "DECLINED", resolution: "DECLINED", resolvedBy, resolvedAt: t, resolutionNote: reason }
              : { status: "RESOLVED", resolution: "INFO", resolvedBy, resolvedAt: t, resolutionNote: reason },
        });
        const after = await prisma.supportCase.findUnique({ where: { id } });
        if (claim.count !== 1 && after?.status === "OPEN") return REFUND_IN_PROGRESS;
        return { status: 200, body: { ok: true, alreadyResolved: claim.count !== 1, case: after } };
      }

      if (action === "credit") {
        if (!supportCase.userId) return { status: 409, body: { error: "This case has no member account to credit.", code: "NO_MEMBER" } };
        const amountCents = body.amountCents;
        const order = supportCase.orderId ? await prisma.order.findUnique({ where: { id: supportCase.orderId } }) : null;
        return prisma.$transaction(async (tx) => {
          const claim = await tx.supportCase.updateMany({
            where: { id, status: "OPEN", resolution: null },
            data: { status: "RESOLVED", resolution: "STAFF_CREDIT", amountCents, resolvedBy, resolvedAt: t, resolutionNote: reason },
          });
          if (claim.count !== 1) {
            const current = await tx.supportCase.findUnique({ where: { id } });
            if (current?.status === "OPEN") return REFUND_IN_PROGRESS;
            return { status: 200, body: { ok: true, alreadyResolved: true, case: current } };
          }
          const lot = await grantCreditInTx(tx, {
            userId: supportCase.userId,
            source: "ADMIN",
            amountCents,
            orderId: order ? order.id : null,
            note: `support case ${id}${reason ? `: ${reason}` : ""} (by ${resolvedBy})`.slice(0, 500),
            now: t,
          });
          return { status: 200, body: { ok: true, alreadyResolved: false, case: await tx.supportCase.findUnique({ where: { id } }), lotId: lot.id } };
        });
      }

      try {
        const r = await fullRefundCase(prisma, stripe, { supportCase, resolvedBy, reason, now: t });
        // A restore that could not happen: tell the owner, not just the clicking staff member.
        if (!r.alreadyResolved && r.warnings.length) {
          try {
            await notifyCase(notifyDeps, r.case, { urgent: false, warnings: r.warnings });
          } catch (err) {
            console.error(`[support] refund warning notify failed for case ${id}:`, err?.message || err);
          }
        }
        return { status: 200, body: { ok: true, ...r } };
      } catch (err) {
        if (err instanceof SupportError) return { status: err.status, body: { error: err.message, code: err.code, ...err.extra } };
        throw err;
      }
    });
    return reply.code(result.status).send(result.body);
  });
}
