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
 *   - /plan/auth is rate limited per ipHash: 5 FAILED attempts per 15 minutes; successes do not count.
 *
 * Deps (prisma, sendSms, summaries) are injectable so the routes can be
 * tested with fastify.inject() and a stub, without a database.
 */

/** Merge `{label: count}` maps, keeping at most TARGETS_PER_SECTION labels. */
export function mergeTargets(existing, incoming) {
  const out = { ...(existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}) };
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return out;
  for (const [rawKey, rawCount] of Object.entries(incoming)) {
    const key = String(rawKey).replace(/\s+/g, " ").trim().slice(0, TARGET_KEY_MAX);
    const count = Math.max(0, Math.min(1000, Math.floor(Number(rawCount) || 0)));
    if (!key || count === 0) continue;
    if (!(key in out) && Object.keys(out).length >= TARGETS_PER_SECTION) continue;
    out[key] = (Number(out[key]) || 0) + count;
  }
  return out;
}

import { PrismaClient } from "@oh/db";
import { sendSMS } from "../notifications.js";
import { generateCode, normalizeCode, safeEqual } from "./codes.js";
import { escalationText, firstChatText, ownerPhone } from "./chappy.js";
import { startVisitSummaries } from "./summaries.js";

const AUDIENCES = ["INVESTOR", "LENDER", "LANDLORD", "PARTNER", "ADVISOR", "INTERNAL"];
const SCENARIOS = ["CONSERVATIVE", "BASE", "AGGRESSIVE"];
const SECTION_KEY_RE = /^[a-z][a-z0-9-]{1,40}$/;
const QUESTIONS_PER_DAY = 20;
const CHAT_PER_SESSION_DAY = 40;
const CHAT_PER_CODE_DAY = 150;
const CHAT_MAX_CHARS = 1500;
const CHAT_HISTORY = 20;
const EVENT_TYPES = ["scenario", "print_view", "printed", "locale"];
const EVENTS_MAX = 50;
const TARGET_KEY_MAX = 40;
const TARGETS_PER_SECTION = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
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
 * @param {{ prisma?: any, sendSms?: (msg: {to: string, body: string}) => Promise<unknown>, apiKey?: string, now?: () => Date, summaries?: false | object }} [deps]
 *   summaries: false disables the idle-visit sweeper (tests); an object is passed to startVisitSummaries.
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

  // Failed-attempt limiter for /plan/auth: 5 failures per ipHash per 15
  // minutes. Successful logins do not count, so an office or a family behind
  // one IP can each open their invitation without locking the others out.
  // In-memory, like the plugin store it replaces (the API runs one replica).
  const FAIL_MAX = 5;
  const FAIL_WINDOW_MS = 15 * 60 * 1000;
  const failures = new Map();
  const failKey = (req) => {
    const h = req.headers["x-plan-ip-hash"];
    return typeof h === "string" && h ? `plan:${h}` : `plan-ip:${req.ip}`;
  };
  const isLocked = (key, t) => {
    const entry = failures.get(key);
    if (!entry) return false;
    if (entry.resetAt <= t) {
      failures.delete(key);
      return false;
    }
    return entry.count >= FAIL_MAX;
  };
  const recordFailure = (key, t) => {
    if (failures.size > 10_000) {
      for (const [k, e] of failures) if (e.resetAt <= t) failures.delete(k);
    }
    const entry = failures.get(key);
    if (!entry || entry.resetAt <= t) failures.set(key, { count: 1, resetAt: t + FAIL_WINDOW_MS });
    else entry.count += 1;
  };

  app.post(
    "/plan/auth",
    { onRequest: requirePlanApiKey },
    async (req, reply) => {
      const t = now().getTime();
      const key = failKey(req);
      if (isLocked(key, t)) return reply.code(429).send({ error: "rate_limited", statusCode: 429 });
      const fail = () => {
        recordFailure(key, t);
        return reply.code(401).send(INVALID);
      };

      const body = req.body || {};
      const ipHashHeader = req.headers["x-plan-ip-hash"];
      const ipHash = typeof ipHashHeader === "string" ? ipHashHeader.slice(0, 128) : null;
      const code = normalizeCode(body.code);
      if (!code) return fail();

      const record = await prisma.planAccessCode.findUnique({
        where: { code },
        include: { _count: { select: { sessions: true } } },
      });

      if (!isActive(record, now())) return fail();
      if (record.maxSessions !== null && record.maxSessions !== undefined && record._count.sessions >= record.maxSessions) {
        return fail();
      }
      failures.delete(key);

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

    const where = { sessionId_sectionKey: { sessionId: sid, sectionKey } };
    const hasTargets = body.targets && typeof body.targets === "object" && Object.keys(body.targets).length > 0;
    let targets;
    if (hasTargets) {
      const existing = await prisma.planSectionView.findUnique({ where });
      targets = mergeTargets(existing?.targets, body.targets);
    }
    await prisma.planSectionView.upsert({
      where,
      create: { sessionId: sid, sectionKey, seconds, interactions, ...(targets ? { targets } : {}) },
      update: { seconds: { increment: seconds }, interactions: { increment: interactions }, ...(targets ? { targets } : {}) },
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
      include: { accessCode: { select: { id: true, label: true, audience: true, revokedAt: true, expiresAt: true } } },
    });
    if (!session || !isActive(session.accessCode, now())) return reply.code(401).send(INVALID);

    // A simple cap so a stuck button or a script cannot page the owner all night:
    // 20 questions per access code in any rolling 24 hours.
    const since = new Date(now().getTime() - 24 * 60 * 60 * 1000);
    const recent = await prisma.planQuestion.count({ where: { accessCodeId: session.accessCode.id, createdAt: { gte: since } } });
    if (recent >= QUESTIONS_PER_DAY) return reply.code(429).send({ error: "too_many_questions" });

    const question = await prisma.planQuestion.create({
      data: { accessCodeId: session.accessCode.id, sectionKey, body: text, contactEmail: contactEmail || null },
    });

    const to = ownerPhone();
    if (to) {
      try {
        await sendSms({
          to,
          body: escalationText({ label: session.accessCode.label, audience: session.accessCode.audience, sectionKey, question: text, contactEmail }),
        });
      } catch (err) {
        app.log.error({ err }, "[plan] question SMS failed");
      }
    }
    return reply.code(201).send({ ok: true, id: question.id });
  });

  // ------------------------------------------------------------------
  // Chappy chat (the LLM call runs in the web BFF; this stores the turns)
  // ------------------------------------------------------------------

  const loadActiveSession = async (sid) => {
    const session = await prisma.planViewSession.findUnique({
      where: { id: sid },
      include: { accessCode: { select: { id: true, label: true, audience: true, revokedAt: true, expiresAt: true } } },
    });
    return session && isActive(session.accessCode, now()) ? session : null;
  };

  const chatHistory = async (sid, take) => {
    const rows = await prisma.planChatMessage.findMany({
      where: { sessionId: sid },
      orderBy: { createdAt: "desc" },
      take,
      select: { role: true, content: true, createdAt: true, escalated: true },
    });
    return rows.reverse();
  };

  app.post("/plan/sessions/:sid/chat/begin", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const { sid } = req.params;
    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const sectionKey = typeof body.sectionKey === "string" && SECTION_KEY_RE.test(body.sectionKey) ? body.sectionKey : null;
    if (message.length < 1 || message.length > CHAT_MAX_CHARS) return reply.code(400).send({ error: "bad_request" });

    const session = await loadActiveSession(sid);
    if (!session) return reply.code(401).send(INVALID);

    const since = new Date(now().getTime() - DAY_MS);
    const [mine, theirs] = await Promise.all([
      prisma.planChatMessage.count({ where: { sessionId: sid, role: "user", createdAt: { gte: since } } }),
      prisma.planChatMessage.count({ where: { accessCodeId: session.accessCode.id, role: "user", createdAt: { gte: since } } }),
    ]);
    if (mine >= CHAT_PER_SESSION_DAY || theirs >= CHAT_PER_CODE_DAY) return reply.code(429).send({ error: "too_many_messages" });

    // The visit started at the end of the last summarized visit (or the session start).
    const lastVisit = await prisma.planVisitSummary.findFirst({ where: { sessionId: sid }, orderBy: { visitEnd: "desc" }, select: { visitEnd: true } });
    const visitStart = lastVisit?.visitEnd || session.startedAt;
    const earlier = await prisma.planChatMessage.count({ where: { sessionId: sid, role: "user", createdAt: { gt: visitStart } } });

    const history = await chatHistory(sid, CHAT_HISTORY);
    await prisma.planChatMessage.create({
      data: { sessionId: sid, accessCodeId: session.accessCode.id, role: "user", content: message, sectionKey },
    });
    await prisma.planViewSession.update({ where: { id: sid }, data: { lastSeenAt: now() } });

    const to = ownerPhone();
    if (earlier === 0 && to) {
      try {
        await sendSms({ to, body: firstChatText({ label: session.accessCode.label, audience: session.accessCode.audience, sectionKey, message }) });
      } catch (err) {
        app.log.error({ err }, "[plan] first-chat SMS failed");
      }
    }
    return reply.send({ ok: true, history: history.map(({ role, content }) => ({ role, content })) });
  });

  app.post("/plan/sessions/:sid/chat/complete", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const { sid } = req.params;
    const body = req.body || {};
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 8000) : "";
    const sectionKey = typeof body.sectionKey === "string" && SECTION_KEY_RE.test(body.sectionKey) ? body.sectionKey : null;
    if (!content) return reply.code(400).send({ error: "bad_request" });
    const session = await loadActiveSession(sid);
    if (!session) return reply.code(401).send(INVALID);
    await prisma.planChatMessage.create({
      data: { sessionId: sid, accessCodeId: session.accessCode.id, role: "assistant", content, sectionKey, escalated: body.escalated === true },
    });
    await prisma.planViewSession.update({ where: { id: sid }, data: { lastSeenAt: now() } });
    return reply.code(201).send({ ok: true });
  });

  app.post("/plan/sessions/:sid/chat/history", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const session = await loadActiveSession(req.params.sid);
    if (!session) return reply.code(401).send(INVALID);
    const history = await chatHistory(req.params.sid, 40);
    return reply.send({ history: history.map(({ role, content }) => ({ role, content })) });
  });

  app.post("/plan/sessions/:sid/event", { onRequest: requirePlanApiKey }, async (req, reply) => {
    const { sid } = req.params;
    const body = req.body || {};
    const type = typeof body.type === "string" ? body.type : "";
    if (!EVENT_TYPES.includes(type)) return reply.code(400).send({ error: "bad_event" });
    const value = typeof body.value === "string" ? body.value.slice(0, 40) : undefined;
    const session = await loadActiveSession(sid);
    if (!session) return reply.code(401).send(INVALID);
    const prior = Array.isArray(session.events) ? session.events : [];
    const events = [...prior, { type, ...(value ? { value } : {}), at: now().toISOString() }].slice(-EVENTS_MAX);
    await prisma.planViewSession.update({ where: { id: sid }, data: { events, lastSeenAt: now() } });
    return reply.send({ ok: true });
  });

  if (deps.summaries !== false) {
    startVisitSummaries({ prisma, sendSms, log: app.log, ...(typeof deps.summaries === "object" ? deps.summaries : {}) });
  }

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
          include: {
            sectionViews: { orderBy: { enteredAt: "asc" } },
            chatMessages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, sectionKey: true, escalated: true, createdAt: true } },
            visitSummaries: { orderBy: { visitEnd: "desc" } },
          },
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
