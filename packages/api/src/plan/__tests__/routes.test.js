/**
 * Plan route tests. Run with:  node --test packages/api/src/plan/__tests__/
 * Uses fastify.inject() and an in-memory Prisma stub, so no database is needed.
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { registerPlanRoutes } from "../routes.js";
import { generateCode, normalizeCode, safeEqual, CODE_WORDS } from "../codes.js";

const API_KEY = "test-plan-key";

function makePrismaStub() {
  const codes = new Map();
  const sessions = new Map();
  const views = new Map();
  const questions = new Map();
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;

  const stub = {
    _codes: codes,
    _sessions: sessions,
    _views: views,
    _questions: questions,
    planAccessCode: {
      async findUnique({ where, include }) {
        const rec = where.code
          ? [...codes.values()].find((c) => c.code === where.code)
          : codes.get(where.id);
        if (!rec) return null;
        const mine = [...sessions.values()].filter((s) => s.accessCodeId === rec.id);
        const out = { ...rec, _count: { sessions: mine.length } };
        if (include?.sessions) {
          out.sessions = mine.map((s) => ({
            ...s,
            sectionViews: [...views.values()].filter((v) => v.sessionId === s.id),
          }));
        }
        if (include?.questions) {
          out.questions = [...questions.values()].filter((q) => q.accessCodeId === rec.id);
        }
        return out;
      },
      async create({ data }) {
        if ([...codes.values()].some((c) => c.code === data.code)) {
          const err = new Error("unique"); err.code = "P2002"; throw err;
        }
        const rec = { id: id("code"), createdAt: new Date(), lastViewedAt: null, revokedAt: null, expiresAt: null, maxSessions: null, ...data };
        codes.set(rec.id, rec);
        return rec;
      },
      async update({ where, data }) {
        const rec = codes.get(where.id);
        Object.assign(rec, data);
        return rec;
      },
      async findMany() {
        return [...codes.values()].map((c) => ({
          ...c,
          _count: {
            sessions: [...sessions.values()].filter((s) => s.accessCodeId === c.id).length,
            questions: [...questions.values()].filter((q) => q.accessCodeId === c.id).length,
          },
        }));
      },
    },
    planViewSession: {
      async create({ data }) {
        const rec = { id: id("sess"), startedAt: new Date(), lastSeenAt: new Date(), totalSeconds: 0, ...data };
        sessions.set(rec.id, rec);
        return rec;
      },
      async findUnique({ where }) {
        const rec = sessions.get(where.id);
        if (!rec) return null;
        return { ...rec, accessCode: codes.get(rec.accessCodeId) };
      },
      async update({ where, data }) {
        const rec = sessions.get(where.id);
        if (data.totalSeconds?.increment) rec.totalSeconds += data.totalSeconds.increment;
        if (data.lastSeenAt) rec.lastSeenAt = data.lastSeenAt;
        return rec;
      },
      async groupBy() {
        const out = new Map();
        for (const s of sessions.values()) out.set(s.accessCodeId, (out.get(s.accessCodeId) || 0) + s.totalSeconds);
        return [...out.entries()].map(([accessCodeId, total]) => ({ accessCodeId, _sum: { totalSeconds: total } }));
      },
    },
    planSectionView: {
      async upsert({ where, create, update }) {
        const key = `${where.sessionId_sectionKey.sessionId}:${where.sessionId_sectionKey.sectionKey}`;
        const existing = views.get(key);
        if (existing) {
          existing.seconds += update.seconds.increment;
          existing.interactions += update.interactions.increment;
          return existing;
        }
        const rec = { id: id("view"), enteredAt: new Date(), ...create };
        views.set(key, rec);
        return rec;
      },
    },
    planQuestion: {
      async create({ data }) {
        const rec = { id: id("q"), createdAt: new Date(), answeredAt: null, answerBody: null, ...data };
        questions.set(rec.id, rec);
        return rec;
      },
      async findUnique({ where }) { return questions.get(where.id) || null; },
      async update({ where, data }) { const rec = questions.get(where.id); Object.assign(rec, data); return rec; },
    },
  };
  return stub;
}

async function buildApp({ prisma, sms = [], now } = {}) {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, { global: false });
  await registerPlanRoutes(app, {
    prisma,
    apiKey: API_KEY,
    sendSms: async (msg) => { sms.push(msg); },
    now,
  });
  await app.ready();
  return app;
}

const auth = ({ ipHash, ...payload }, key = API_KEY) => ({
  method: "POST",
  url: "/plan/auth",
  headers: { "x-plan-api-key": key, ...(ipHash ? { "x-plan-ip-hash": ipHash } : {}) },
  payload,
});

describe("codes.js", () => {
  test("generateCode matches OH-WORD-DDDD and uses the word list", () => {
    for (let i = 0; i < 50; i += 1) {
      const c = generateCode();
      const m = c.match(/^OH-([A-Z]+)-(\d{4})$/);
      assert.ok(m, c);
      assert.ok(CODE_WORDS.includes(m[1]));
    }
  });
  test("normalizeCode tolerates spacing and case", () => {
    assert.equal(normalizeCode("  oh kestrel 7742 "), "OH-KESTREL-7742");
    assert.equal(normalizeCode("oh--kestrel__7742"), "OH-KESTREL-7742");
    assert.equal(normalizeCode(42), "");
  });
  test("safeEqual", () => {
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abd"), false);
    assert.equal(safeEqual("abc", "abcd"), false);
    assert.equal(safeEqual(undefined, "abc"), false);
  });
});

describe("/plan/auth", () => {
  let prisma; let app;
  beforeEach(async () => {
    prisma = makePrismaStub();
    await prisma.planAccessCode.create({ data: { code: "OH-KESTREL-7742", label: "Jim R.", audience: "LENDER", defaultScenario: "CONSERVATIVE", allowedSections: ["model", "funding"] } });
    await prisma.planAccessCode.create({ data: { code: "OH-RAVEN-1111", label: "Gone", audience: "INVESTOR", defaultScenario: "BASE", allowedSections: [], revokedAt: new Date() } });
    await prisma.planAccessCode.create({ data: { code: "OH-OTTER-2222", label: "Old", audience: "INVESTOR", defaultScenario: "BASE", allowedSections: [], expiresAt: new Date(Date.now() - 1000) } });
    await prisma.planAccessCode.create({ data: { code: "OH-MOSS-3333", label: "One seat", audience: "ADVISOR", defaultScenario: "BASE", allowedSections: [], maxSessions: 1 } });
    app = await buildApp({ prisma });
  });

  test("rejects without the shared key", async () => {
    const res = await app.inject({ method: "POST", url: "/plan/auth", headers: { "x-plan-ip-hash": "h1" }, payload: { code: "OH-KESTREL-7742" } });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: "unauthorized" });
  });

  test("valid code creates a session and returns claims", async () => {
    const res = await app.inject(auth({ code: "oh kestrel 7742", ipHash: "h1", userAgent: "UA" }));
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.audience, "LENDER");
    assert.equal(body.scenario, "CONSERVATIVE");
    assert.deepEqual(body.sections, ["model", "funding"]);
    assert.equal(body.label, "Jim R.");
    assert.ok(prisma._sessions.get(body.sid));
    assert.equal(prisma._sessions.get(body.sid).ipHash, "h1");
    assert.ok(prisma._codes.get(body.acid).lastViewedAt instanceof Date);
  });

  test("wrong, revoked, expired and over-limit codes return byte-identical 401 bodies", async () => {
    const wrong = await app.inject(auth({ code: "OH-NOPE-0000", ipHash: "a" }));
    const revoked = await app.inject(auth({ code: "OH-RAVEN-1111", ipHash: "b" }));
    const expired = await app.inject(auth({ code: "OH-OTTER-2222", ipHash: "c" }));
    const first = await app.inject(auth({ code: "OH-MOSS-3333", ipHash: "d" }));
    const second = await app.inject(auth({ code: "OH-MOSS-3333", ipHash: "e" }));
    const empty = await app.inject(auth({ ipHash: "f" }));
    assert.equal(first.statusCode, 200);
    for (const r of [wrong, revoked, expired, second, empty]) {
      assert.equal(r.statusCode, 401);
      assert.equal(r.body, wrong.body);
    }
  });

  test("6th attempt from the same ipHash within 15 minutes is rate limited", async () => {
    for (let i = 0; i < 5; i += 1) {
      const r = await app.inject(auth({ code: "OH-NOPE-0000", ipHash: "same" }));
      assert.equal(r.statusCode, 401);
    }
    const sixth = await app.inject(auth({ code: "OH-KESTREL-7742", ipHash: "same" }));
    assert.equal(sixth.statusCode, 429);
    assert.equal(sixth.json().error, "rate_limited");
    const other = await app.inject(auth({ code: "OH-KESTREL-7742", ipHash: "different" }));
    assert.equal(other.statusCode, 200);
  });
});

describe("heartbeat and questions", () => {
  let prisma; let app; let sid; const sms = [];
  beforeEach(async () => {
    prisma = makePrismaStub();
    sms.length = 0;
    await prisma.planAccessCode.create({ data: { code: "OH-KESTREL-7742", label: "Jim R.", audience: "LENDER", defaultScenario: "BASE", allowedSections: [] } });
    app = await buildApp({ prisma, sms });
    const res = await app.inject(auth({ code: "OH-KESTREL-7742", ipHash: "h" }));
    sid = res.json().sid;
  });

  test("heartbeat accumulates seconds and interactions per section", async () => {
    const h = (payload) => app.inject({ method: "POST", url: `/plan/sessions/${sid}/heartbeat`, headers: { "x-plan-api-key": API_KEY }, payload });
    assert.equal((await h({ sectionKey: "model", seconds: 15, interactions: 2 })).statusCode, 200);
    assert.equal((await h({ sectionKey: "model", seconds: 10, interactions: 1 })).statusCode, 200);
    assert.equal((await h({ sectionKey: "funding", seconds: 5 })).statusCode, 200);
    assert.equal(prisma._views.get(`${sid}:model`).seconds, 25);
    assert.equal(prisma._views.get(`${sid}:model`).interactions, 3);
    assert.equal(prisma._sessions.get(sid).totalSeconds, 30);
    assert.equal((await h({ sectionKey: "Bad Key!", seconds: 5 })).statusCode, 400);
    assert.equal((await app.inject({ method: "POST", url: `/plan/sessions/nope/heartbeat`, headers: { "x-plan-api-key": API_KEY }, payload: { sectionKey: "model", seconds: 1 } })).statusCode, 401);
  });

  test("status reports active until the code is revoked", async () => {
    const status = () => app.inject({ method: "POST", url: `/plan/sessions/${sid}/status`, headers: { "x-plan-api-key": API_KEY }, payload: {} });
    assert.deepEqual((await status()).json(), { active: true });
    const code = [...prisma._codes.values()][0];
    code.revokedAt = new Date();
    assert.deepEqual((await status()).json(), { active: false });
    assert.deepEqual((await app.inject({ method: "POST", url: "/plan/sessions/nope/status", headers: { "x-plan-api-key": API_KEY }, payload: {} })).json(), { active: false });
    assert.equal((await app.inject({ method: "POST", url: `/plan/sessions/${sid}/status`, payload: {} })).statusCode, 401);
  });

  test("heartbeat stops once the code is revoked", async () => {
    const code = [...prisma._codes.values()][0];
    code.revokedAt = new Date();
    const r = await app.inject({ method: "POST", url: `/plan/sessions/${sid}/heartbeat`, headers: { "x-plan-api-key": API_KEY }, payload: { sectionKey: "model", seconds: 1 } });
    assert.equal(r.statusCode, 401);
  });

  test("question is stored and an SMS goes to the owner", async () => {
    process.env.OWNER_ALERT_PHONE = "+15555550100";
    const r = await app.inject({ method: "POST", url: `/plan/sessions/${sid}/questions`, headers: { "x-plan-api-key": API_KEY }, payload: { sectionKey: "sensitivity", body: "What happens if beef doubles?", contactEmail: "jim@example.com" } });
    assert.equal(r.statusCode, 201);
    assert.equal(prisma._questions.size, 1);
    assert.equal(sms.length, 1);
    assert.match(sms[0].body, /Jim R\./);
    assert.match(sms[0].body, /sensitivity/);
    const bad = await app.inject({ method: "POST", url: `/plan/sessions/${sid}/questions`, headers: { "x-plan-api-key": API_KEY }, payload: { sectionKey: "sensitivity", body: "x" } });
    assert.equal(bad.statusCode, 400);
  });
});

describe("/admin/plan", () => {
  let prisma; let app;
  beforeEach(async () => {
    prisma = makePrismaStub();
    app = await buildApp({ prisma });
  });

  test("issue, list, drill-down, revoke, answer", async () => {
    const created = await app.inject({ method: "POST", url: "/admin/plan/codes", payload: { label: "Jim R. - AFCU", audience: "LENDER", defaultScenario: "CONSERVATIVE", allowedSections: ["model", "funding", "bad key"], expiresAt: "2027-01-01T00:00:00Z", maxSessions: "3" } });
    assert.equal(created.statusCode, 201, created.body);
    const code = created.json().code;
    assert.match(code.code, /^OH-[A-Z]+-\d{4}$/);
    assert.deepEqual(code.allowedSections, ["model", "funding"]);
    assert.equal(code.maxSessions, 3);

    const bad = await app.inject({ method: "POST", url: "/admin/plan/codes", payload: { label: "", audience: "LENDER" } });
    assert.equal(bad.statusCode, 400);
    const badAud = await app.inject({ method: "POST", url: "/admin/plan/codes", payload: { label: "x", audience: "KING" } });
    assert.equal(badAud.statusCode, 400);

    const authed = await app.inject(auth({ code: code.code, ipHash: "h" }));
    const sid = authed.json().sid;
    await app.inject({ method: "POST", url: `/plan/sessions/${sid}/heartbeat`, headers: { "x-plan-api-key": API_KEY }, payload: { sectionKey: "model", seconds: 40, interactions: 4 } });
    await app.inject({ method: "POST", url: `/plan/sessions/${sid}/questions`, headers: { "x-plan-api-key": API_KEY }, payload: { sectionKey: "model", body: "Why 75 pods?" } });

    const list = await app.inject({ method: "GET", url: "/admin/plan/codes" });
    assert.equal(list.statusCode, 200);
    const row = list.json().codes[0];
    assert.equal(row.status, "ACTIVE");
    assert.equal(row.sessionCount, 1);
    assert.equal(row.questionCount, 1);
    assert.equal(row.totalSeconds, 40);

    const detail = await app.inject({ method: "GET", url: `/admin/plan/codes/${code.id}` });
    assert.equal(detail.statusCode, 200);
    assert.deepEqual(detail.json().heat, [{ sectionKey: "model", seconds: 40, interactions: 4, sessions: 1 }]);
    assert.equal(detail.json().code.questions.length, 1);
    assert.equal((await app.inject({ method: "GET", url: "/admin/plan/codes/nope" })).statusCode, 404);

    const qid = detail.json().code.questions[0].id;
    const answered = await app.inject({ method: "PATCH", url: `/admin/plan/questions/${qid}/answer`, payload: { answerBody: "Throughput." } });
    assert.equal(answered.statusCode, 200);
    assert.ok(answered.json().question.answeredAt);

    const revoked = await app.inject({ method: "PATCH", url: `/admin/plan/codes/${code.id}/revoke` });
    assert.equal(revoked.statusCode, 200);
    assert.ok(revoked.json().code.revokedAt);
    const again = await app.inject(auth({ code: code.code, ipHash: "h2" }));
    assert.equal(again.statusCode, 401);
    const list2 = await app.inject({ method: "GET", url: "/admin/plan/codes" });
    assert.equal(list2.json().codes[0].status, "REVOKED");
    assert.equal((await app.inject({ method: "PATCH", url: "/admin/plan/codes/nope/revoke" })).statusCode, 404);
  });
});
