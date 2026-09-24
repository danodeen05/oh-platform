/**
 * Interactive Business Plan routes.
 *
 * Two groups:
 *   /plan/*        Called ONLY by the web app's server-side route handlers (BFF).
 *                  Guarded by the shared PLAN_API_KEY header. Never called from a browser.
 *   /admin/plan/*  Admin console. Guarded by the existing /admin onRequest hook in index.js.
 *
 * Security rules (see spec section 4.3 / 7.7):
 *   - Wrong, revoked, expired, and over-limit codes all return the same 401 body.
 *   - Raw access codes are never logged. Raw IPs never reach this service; the
 *     web BFF sends a salted hash.
 *   - /plan/auth is rate limited per ipHash: 5 attempts per 15 minutes.
 *
 * Deps (prisma, sendSms) are injectable so the routes can be tested with
 * fastify.inject() and a stub, without a database.
 */

import { PrismaClient } from "@oh/db";
import { sendSMS } from "../notifications.js";
import { generateCode, normalizeCode, safeEqual } from "./codes.js";

const AUDIENCES = ["INVESTOR", "LENDER", "LANDLORD", "PARTNER", "ADVISOR", "INTERNAL"];
const SCENARIOS = ["CONSERVATIVE", "BASE", "AGGRESSIVE"];
const SECTION_KEY_RE = /^[a-z][a-z0-9-]{1,40}$/;
const INVALID = { error: "invalid" };

let defaultPrisma = null;
function getDefaultPrisma() {
  if (!defaultPrisma) defaultPrisma = new PrismaClient();
  return defaultPrisma;
}

function isActive(code, now = new Date()) {
  if (!code) return false;
  if (code.revokedAt) return false;
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

function codeStatus(code, now = new Date()) {
  if (code.revokedAt) return "REVOKED";
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "ACTIVE";
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{ prisma?: any, sendSms?: (msg: {to: string, body: string}) => Promise<unknown>, apiKey?: string, now?: () => Date }} [deps]
 */
export async function registerPlanRoutes(app, deps = {}) {
  const prisma = deps.prisma || getDefaultPrisma();
  const sendSms = deps.sendSms || sendSMS;
  const now = deps.now || (() => new Date());
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : process.env.PLAN_API_KEY;

  if (!apiKey) {
    app.log.warn("[plan] PLAN_API_KEY is not set; all /plan/* BFF routes will refuse requests");
  }

  /** Shared-key guard for the BFF routes. Fails closed when the key is missing. */
  const requirePlanApiKey = async (req, reply) => {
    const provided = req.headers["x-plan-api-key"];
    if (!apiKey || !safeEqual(typeof provided === "string" ? provided : "", apiKey)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  };

  // ------------------------------------------------------------------
  // BFF routes
  // ------------------------------------------------------------------

  app.post(
    "/plan/auth",
    {
      onRequest: requirePlanApiKey,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          // Runs in the onRequest phase, before the body is parsed, so the
          // web BFF sends the salted IP hash as a header, not in the body.
          keyGenerator: (req) => {
            const h = req.headers["x-plan-ip-hash"];
            return typeof h === "string" && h ? `plan:${h}` : `plan-ip:${req.ip}`;
          },
          errorResponseBuilder: () => ({ error: "rate_limited", statusCode: 429 }),
        },
      },
    },
    async (req, reply) => {
      const body = req.body || {};
      const ipHashHeader = req.headers["x-plan-ip-hash"];
      const ipHash = typeof ipHashHeader === "string" ? ipHashHeader.slice(0, 128) : null;
      const code = normalizeCode(body.code);
      if (!code) return reply.code(401).send(INVALID);

      const record = await prisma.planAccessCode.findUnique({
        where: { code },
        include: { _count: { select: { sessions: true } } },
      });

      if (!isActive(record, now())) return reply.code(401).send(INVALID);
      if (record.maxSessions !== null && record.maxSessions !== undefined && record._count.sessions >= record.maxSessions) {
        return reply.code(401).send(INVALID);
      }

      const session = await prisma.planViewSession.create({
        data: {
          accessCodeId: record.id,
          userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 512) : null,
          ipHash,
          country: typeof body.country === "string" ? body.country.slice(0, 8) : null,
        },
      });
      await prisma.planAccessCode.update({ where: { id: record.id }, data: { lastViewedAt: now() } });

      return reply.send({
        sid: session.id,
        acid: record.id,
        audience: record.audience,
        scenario: record.defaultScenario,
        sections: record.allowedSections,
        label: record.label,
      });
    },
  );

  // Live liveness check used by the web app on every gated render, so a
  // revoked or expired code is cut off immediately rather than at cookie expiry.
  app.post("/plan/sessions/:sid/status", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const session = await prisma.planViewSession.findUnique({
      where: { id: req.params.sid },
      include: { accessCode: { select: { revokedAt: true, expiresAt: true } } },
    });
    return reply.send({ active: Boolean(session && isActive(session.accessCode, now())) });
  });

  app.post("/plan/sessions/:sid/heartbeat", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const { sid } = req.params;
    const body = req.body || {};
    const sectionKey = typeof body.sectionKey === "string" ? body.sectionKey : "";
    const seconds = Math.max(0, Math.min(3600, Math.floor(Number(body.seconds) || 0)));
    const interactions = Math.max(0, Math.min(10000, Math.floor(Number(body.interactions) || 0)));
    if (!SECTION_KEY_RE.test(sectionKey)) return reply.code(400).send({ error: "bad_section" });

    const session = await prisma.planViewSession.findUnique({
      where: { id: sid },
      include: { accessCode: { select: { id: true, revokedAt: true, expiresAt: true } } },
    });
    if (!session || !isActive(session.accessCode, now())) return reply.code(401).send(INVALID);

    await prisma.planSectionView.upsert({
      where: { sessionId_sectionKey: { sessionId: sid, sectionKey } },
      create: { sessionId: sid, sectionKey, seconds, interactions },
      update: { seconds: { increment: seconds }, interactions: { increment: interactions } },
    });
    await prisma.planViewSession.update({
      where: { id: sid },
      data: { totalSeconds: { increment: seconds }, lastSeenAt: now() },
    });
    await prisma.planAccessCode.update({ where: { id: session.accessCode.id }, data: { lastViewedAt: now() } });
    return reply.send({ ok: true });
  });

  app.post("/plan/sessions/:sid/questions", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const { sid } = req.params;
    const body = req.body || {};
    const sectionKey = typeof body.sectionKey === "string" ? body.sectionKey : "";
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().slice(0, 254) : null;
    if (!SECTION_KEY_RE.test(sectionKey) || text.length < 3) return reply.code(400).send({ error: "bad_request" });

    const session = await prisma.planViewSession.findUnique({
      where: { id: sid },
      include: { accessCode: { select: { id: true, label: true, revokedAt: true, expiresAt: true } } },
    });
    if (!session || !isActive(session.accessCode, now())) return reply.code(401).send(INVALID);

    const question = await prisma.planQuestion.create({
      data: { accessCodeId: session.accessCode.id, sectionKey, body: text, contactEmail: contactEmail || null },
    });

    const to = process.env.OWNER_ALERT_PHONE || process.env.ADMIN_PHONE_NUMBER;
    if (to) {
      try {
        await sendSms({
          to,
          body: `Plan question from ${session.accessCode.label} (${sectionKey}): ${text.slice(0, 200)}`,
        });
      } catch (err) {
        app.log.error({ err }, "[plan] question SMS failed");
      }
    }
    return reply.code(201).send({ ok: true, id: question.id });
  });

  // ------------------------------------------------------------------
  // Admin routes (guarded by the /admin hook in index.js)
  // ------------------------------------------------------------------

  app.get("/admin/plan/codes", async (req, reply) => {
    const codes = await prisma.planAccessCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sessions: true, questions: true } } },
    });
    const totals = await prisma.planViewSession.groupBy({
      by: ["accessCodeId"],
      _sum: { totalSeconds: true },
    });
    const secondsByCode = new Map(totals.map((t) => [t.accessCodeId, t._sum.totalSeconds || 0]));
    const t = now();
    return reply.send({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        audience: c.audience,
        defaultScenario: c.defaultScenario,
        allowedSections: c.allowedSections,
        expiresAt: c.expiresAt,
        revokedAt: c.revokedAt,
        maxSessions: c.maxSessions,
        createdAt: c.createdAt,
        lastViewedAt: c.lastViewedAt,
        status: codeStatus(c, t),
        sessionCount: c._count.sessions,
        questionCount: c._count.questions,
        totalSeconds: secondsByCode.get(c.id) || 0,
      })),
    });
  });

  app.post("/admin/plan/codes", async (req, reply) => {
    const body = req.body || {};
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
    const audience = AUDIENCES.includes(body.audience) ? body.audience : null;
    const defaultScenario = SCENARIOS.includes(body.defaultScenario) ? body.defaultScenario : "BASE";
    const allowedSections = Array.isArray(body.allowedSections)
      ? body.allowedSections.filter((s) => typeof s === "string" && SECTION_KEY_RE.test(s))
      : [];
    const expiresAt = parseDate(body.expiresAt);
    const maxSessions = body.maxSessions === null || body.maxSessions === undefined || body.maxSessions === ""
      ? null
      : Math.max(1, Math.floor(Number(body.maxSessions)));

    if (!label || !audience) return reply.code(400).send({ error: "label and audience are required" });
    if (expiresAt === undefined) return reply.code(400).send({ error: "invalid expiresAt" });
    if (maxSessions !== null && !Number.isFinite(maxSessions)) return reply.code(400).send({ error: "invalid maxSessions" });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      try {
        const created = await prisma.planAccessCode.create({
          data: {
            code,
            label,
            audience,
            defaultScenario,
            allowedSections,
            expiresAt,
            maxSessions,
            createdByUserId: typeof body.createdByUserId === "string" ? body.createdByUserId.slice(0, 64) : null,
          },
        });
        return reply.code(201).send({ code: created });
      } catch (err) {
        // P2002 = unique constraint on code; try another word/number pair.
        if (err?.code !== "P2002") throw err;
      }
    }
    return reply.code(500).send({ error: "could not allocate a unique code" });
  });

  app.patch("/admin/plan/codes/:id/revoke", async (req, reply) => {
    const { id } = req.params;
    const existing = await prisma.planAccessCode.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    const updated = await prisma.planAccessCode.update({
      where: { id },
      data: { revokedAt: existing.revokedAt || now() },
    });
    return reply.send({ code: updated });
  });

  app.get("/admin/plan/codes/:id", async (req, reply) => {
    const { id } = req.params;
    const code = await prisma.planAccessCode.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { startedAt: "desc" },
          include: { sectionViews: { orderBy: { enteredAt: "asc" } } },
        },
        questions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!code) return reply.code(404).send({ error: "not found" });

    const heat = new Map();
    for (const s of code.sessions) {
      for (const v of s.sectionViews) {
        const agg = heat.get(v.sectionKey) || { sectionKey: v.sectionKey, seconds: 0, interactions: 0, sessions: 0 };
        agg.seconds += v.seconds;
        agg.interactions += v.interactions;
        agg.sessions += 1;
        heat.set(v.sectionKey, agg);
      }
    }
    return reply.send({
      code: { ...code, status: codeStatus(code, now()) },
      heat: [...heat.values()].sort((a, b) => b.seconds - a.seconds),
    });
  });

  app.patch("/admin/plan/questions/:id/answer", async (req, reply) => {
    const { id } = req.params;
    const answerBody = typeof req.body?.answerBody === "string" ? req.body.answerBody.trim().slice(0, 4000) : "";
    if (!answerBody) return reply.code(400).send({ error: "answerBody is required" });
    const existing = await prisma.planQuestion.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    const updated = await prisma.planQuestion.update({
      where: { id },
      data: { answerBody, answeredAt: now() },
    });
    return reply.send({ question: updated });
  });
}
