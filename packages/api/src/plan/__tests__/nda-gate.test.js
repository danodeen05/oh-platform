/** NDA state on auth/status and the content-route gate. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import { registerPlanRoutes } from "../routes.js";
import { createPii } from "../pii.js";
import { makePrismaStub } from "./helpers/prisma-stub.js";

const API_KEY = "test-plan-key";
const H = { "x-plan-api-key": API_KEY };
const pii = createPii(crypto.randomBytes(32));

async function buildApp(prisma, sms = []) {
  const app = Fastify({ logger: false });
  await registerPlanRoutes(app, { prisma, apiKey: API_KEY, sendSms: async (m) => { sms.push(m); return { success: true }; }, summaries: false, pii, sendMail: async () => ({ success: true }) });
  await app.ready();
  return app;
}

const post = (app, url, payload = {}) => app.inject({ method: "POST", url, headers: H, payload });

describe("NDA gate", () => {
  let prisma, app, sms, code;
  beforeEach(async () => {
    prisma = makePrismaStub();
    sms = [];
    app = await buildApp(prisma, sms);
    code = await prisma.planAccessCode.create({ data: { code: "OH-NDA-1111", label: "Jim R.", audience: "INVESTOR", defaultScenario: "BASE", allowedSections: [], ndaRequired: true } });
  });

  const login = async () => (await post(app, "/plan/auth", { code: code.code })).json();

  test("auth and status report pending until an NDA is signed", async () => {
    const a = await login();
    assert.equal(a.nda, "pending");
    const s = (await post(app, `/plan/sessions/${a.sid}/status`)).json();
    assert.deepEqual(s, { active: true, nda: "pending", contactOnFile: false });
  });

  test("codes without the flag report none", async () => {
    await prisma.planAccessCode.update({ where: { id: code.id }, data: { ndaRequired: false } });
    const a = await login();
    assert.equal(a.nda, "none");
  });

  test("content routes return 403 nda_required while pending", async () => {
    const a = await login();
    const urls = [
      [`/plan/sessions/${a.sid}/heartbeat`, { sectionKey: "summary", seconds: 5 }],
      [`/plan/sessions/${a.sid}/questions`, { sectionKey: "summary", body: "What about rent?" }],
      [`/plan/sessions/${a.sid}/chat/begin`, { message: "hi" }],
      [`/plan/sessions/${a.sid}/chat/complete`, { content: "hello" }],
      [`/plan/sessions/${a.sid}/chat/history`, {}],
      [`/plan/sessions/${a.sid}/event`, { type: "printed" }],
    ];
    for (const [url, body] of urls) {
      const r = await post(app, url, body);
      assert.equal(r.statusCode, 403, url);
      assert.equal(r.json().error, "nda_required");
    }
    assert.equal(sms.length, 0);
  });

  test("turning the flag off lets a pending viewer straight in", async () => {
    const a = await login();
    await prisma.planAccessCode.update({ where: { id: code.id }, data: { ndaRequired: false } });
    assert.equal((await post(app, `/plan/sessions/${a.sid}/status`)).json().nda, "none");
    assert.equal((await post(app, `/plan/sessions/${a.sid}/heartbeat`, { sectionKey: "summary", seconds: 5 })).statusCode, 200);
  });

  test("a revoked code is inactive even while its NDA is pending", async () => {
    const a = await login();
    await prisma.planAccessCode.update({ where: { id: code.id }, data: { revokedAt: new Date() } });
    assert.equal((await post(app, `/plan/sessions/${a.sid}/status`)).json().active, false);
  });

  test("once signed: content opens and questions reuse the NDA email", async () => {
    process.env.OWNER_ALERT_PHONE = "+15555550100";
    const a = await login();
    await prisma.planNda.create({ data: { accessCodeId: code.id, status: "SIGNED", emailEnc: pii.seal("jim@firm.com") } });
    const s = (await post(app, `/plan/sessions/${a.sid}/status`)).json();
    assert.deepEqual(s, { active: true, nda: "signed", contactOnFile: true });
    const q = await post(app, `/plan/sessions/${a.sid}/questions`, { sectionKey: "summary", body: "What about rent?" });
    assert.equal(q.statusCode, 201);
    const stored = [...prisma._questions.values()][0];
    assert.equal(stored.contactEmail, "jim@firm.com");
    assert.match(sms[0].body, /jim@firm\.com/);
  });

  test("admin create accepts ndaRequired and the list reports NDA status", async () => {
    const c = await app.inject({ method: "POST", url: "/admin/plan/codes", payload: { label: "Landlord", audience: "LANDLORD", ndaRequired: true } });
    assert.equal(c.statusCode, 201);
    assert.equal(c.json().code.ndaRequired, true);
    const plain = await app.inject({ method: "POST", url: "/admin/plan/codes", payload: { label: "Friend", audience: "ADVISOR" } });
    assert.equal(plain.json().code.ndaRequired, false);
    await prisma.planNda.create({ data: { accessCodeId: code.id, status: "SIGNED", signedAt: new Date("2026-09-27T12:00:00Z") } });
    const list = (await app.inject({ method: "GET", url: "/admin/plan/codes" })).json().codes;
    const byLabel = Object.fromEntries(list.map((r) => [r.label, r]));
    assert.equal(byLabel["Jim R."].ndaStatus, "SIGNED");
    assert.equal(byLabel["Landlord"].ndaStatus, "PENDING");
    assert.equal(byLabel["Friend"].ndaStatus, "NOT_REQUIRED");
  });
});
