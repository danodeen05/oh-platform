/** NDA BFF routes: details, phone code, verify, sign, pdf. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import { registerPlanRoutes } from "../routes.js";
import { createPii } from "../pii.js";
import { makePrismaStub } from "./helpers/prisma-stub.js";

const API_KEY = "test-plan-key";
const H = { "x-plan-api-key": API_KEY };
const PNG = `data:image/png;base64,${Buffer.from("fakepng").toString("base64")}`;
const PDF = Buffer.from("%PDF-1.7\nfake executed nda\n%%EOF");

const DETAILS = {
  legalName: "James Robertson",
  email: "jim@firm.com",
  phone: "(801) 555-1234",
  address: { line1: "1 Main St", city: "Lehi", region: "UT", postalCode: "84043" },
  company: "America First CU",
  title: "VP",
};

async function setup({ withPii = true } = {}) {
  const prisma = makePrismaStub();
  const sms = [];
  const delivered = [];
  let clock = new Date("2026-09-27T18:00:00Z").getTime();
  const pii = withPii ? createPii(crypto.randomBytes(32)) : null;
  const app = Fastify({ logger: false });
  await registerPlanRoutes(app, {
    prisma,
    apiKey: API_KEY,
    sendSms: async (m) => { sms.push(m); return { success: true }; },
    summaries: false,
    pii,
    now: () => new Date(clock),
    deliverNda: (id) => { delivered.push(id); },
  });
  await app.ready();
  const code = await prisma.planAccessCode.create({ data: { code: "OH-NDA-2222", label: "Jim R.", audience: "INVESTOR", defaultScenario: "BASE", allowedSections: [], ndaRequired: true } });
  const auth = (await app.inject({ method: "POST", url: "/plan/auth", headers: H, payload: { code: code.code } })).json();
  const post = (path, payload = {}) => app.inject({ method: "POST", url: `/plan/sessions/${auth.sid}/nda${path}`, headers: H, payload });
  return { prisma, sms, delivered, pii, app, code, auth, post, tick: (ms) => { clock += ms; }, nowIso: () => new Date(clock).toISOString() };
}

const lastCode = (sms) => sms.at(-1).body.match(/(\d{6})/)[1];

async function toSignStep(t) {
  await t.post("/details", DETAILS);
  await t.post("/code");
  await t.post("/verify", { code: lastCode(t.sms) });
}

const signBody = (t, extra = {}) => ({
  version: "2026.09.27",
  documentSha256: "a".repeat(64),
  signature: { kind: "typed", image: PNG },
  consent: { electronic: true, terms: true },
  signedAt: t.nowIso(),
  ip: "203.0.113.9",
  userAgent: "Mozilla/5.0 test",
  pdf: PDF.toString("base64"),
  ...extra,
});

describe("NDA routes", () => {
  let t;
  beforeEach(async () => { t = await setup(); });

  test("starts at details", async () => {
    const s = (await t.post("")).json();
    assert.equal(s.required, true);
    assert.equal(s.step, "details");
    assert.equal(s.details, null);
    assert.equal(s.countersigner, null);
  });

  test("invalid details are rejected field by field", async () => {
    const r = await t.post("/details", { ...DETAILS, email: "nope", phone: "12" });
    assert.equal(r.statusCode, 400);
    assert.ok(r.json().errors.email);
    assert.ok(r.json().errors.phone);
  });

  test("details are stored encrypted and a reload resumes at verify with them", async () => {
    const r = await t.post("/details", DETAILS);
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().step, "verify");
    const row = t.prisma._ndas[0];
    assert.ok(!JSON.stringify(row).includes("Robertson"));
    const again = (await t.post("")).json();
    assert.equal(again.step, "verify");
    assert.equal(again.details.legalName, "James Robertson");
    assert.equal(again.details.phone, "+18015551234");
    assert.equal(again.phoneMasked, "•••-•••-1234");
  });

  test("phone code: texts, cooldown, and a send cap", async () => {
    await t.post("/details", DETAILS);
    const first = await t.post("/code");
    assert.equal(first.statusCode, 200);
    assert.equal(t.sms[0].to, "+18015551234");
    assert.match(t.sms[0].body, /^Oh! Beef Noodle Soup: \d{6} is your code to sign the NDA\. It expires in 10 minutes\.$/);
    const tooSoon = await t.post("/code");
    assert.equal(tooSoon.statusCode, 429);
    assert.ok(tooSoon.json().retryIn > 0);
    for (let i = 0; i < 7; i += 1) { t.tick(61_000); assert.equal((await t.post("/code")).statusCode, 200); }
    t.tick(61_000);
    assert.equal((await t.post("/code")).json().error, "too_many_codes");
  });

  test("code needs details first", async () => {
    assert.equal((await t.post("/code")).statusCode, 409);
  });

  test("verify: wrong codes count down, then lock until a new code", async () => {
    await t.post("/details", DETAILS);
    await t.post("/code");
    const good = lastCode(t.sms);
    const bad = good === "000000" ? "111111" : "000000";
    const w = await t.post("/verify", { code: bad });
    assert.equal(w.statusCode, 400);
    assert.equal(w.json().remaining, 4);
    for (let i = 0; i < 4; i += 1) await t.post("/verify", { code: bad });
    const locked = await t.post("/verify", { code: good });
    assert.equal(locked.json().error, "expired");
    t.tick(61_000);
    await t.post("/code");
    const ok = await t.post("/verify", { code: lastCode(t.sms) });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().step, "sign");
  });

  test("verify: codes expire after 10 minutes", async () => {
    await t.post("/details", DETAILS);
    await t.post("/code");
    t.tick(10 * 60_000 + 1);
    assert.equal((await t.post("/verify", { code: lastCode(t.sms) })).json().error, "expired");
  });

  test("changing the phone re-verifies; changing the address does not", async () => {
    await toSignStep(t);
    const addr = await t.post("/details", { ...DETAILS, address: { ...DETAILS.address, line1: "2 Main St" } });
    assert.equal(addr.json().step, "sign");
    const phone = await t.post("/details", { ...DETAILS, phone: "801-555-9999" });
    assert.equal(phone.json().step, "verify");
  });

  test("sign refuses without a countersigner, consent, a real PDF, or a fresh timestamp", async () => {
    await toSignStep(t);
    assert.equal((await t.post("/sign", signBody(t))).json().error, "no_countersigner");
    await t.prisma.planNdaCountersigner.upsert({ create: { name: "Dano", title: "Founder", signature: PNG }, update: {} });
    assert.equal((await t.post("/sign", signBody(t, { consent: { electronic: true, terms: false } }))).statusCode, 400);
    assert.equal((await t.post("/sign", signBody(t, { pdf: Buffer.from("nope").toString("base64") }))).statusCode, 400);
    assert.equal((await t.post("/sign", signBody(t, { signature: { kind: "typed", image: "javascript:x" } }))).statusCode, 400);
    assert.equal((await t.post("/sign", signBody(t, { signedAt: new Date(Date.parse(t.nowIso()) - 6 * 60_000).toISOString() }))).statusCode, 400);
    assert.equal(t.delivered.length, 0);
  });

  test("sign before verifying is refused", async () => {
    await t.prisma.planNdaCountersigner.upsert({ create: { name: "Dano", title: "Founder", signature: PNG }, update: {} });
    await t.post("/details", DETAILS);
    assert.equal((await t.post("/sign", signBody(t))).json().error, "not_ready");
  });

  test("sign stores everything once, delivers once, and opens the plan", async () => {
    await t.prisma.planNdaCountersigner.upsert({ create: { name: "Dano Deen", title: "Founder", signature: PNG }, update: {} });
    await toSignStep(t);
    const [a, b] = await Promise.all([t.post("/sign", signBody(t)), t.post("/sign", signBody(t))]);
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    assert.equal(t.delivered.length, 1, "exactly one delivery for a double submit");
    const row = t.prisma._ndas[0];
    assert.equal(row.status, "SIGNED");
    assert.equal(row.countersignerName, "Dano Deen");
    assert.equal(row.documentSha256, "a".repeat(64));
    assert.equal(row.pdfSha256, crypto.createHash("sha256").update(PDF).digest("hex"));
    assert.equal(t.pii.open(row.signerIpEnc), "203.0.113.9");
    assert.equal(row.otpHash, null);
    const status = (await t.app.inject({ method: "POST", url: `/plan/sessions/${t.auth.sid}/status`, headers: H })).json();
    assert.equal(status.nda, "signed");
    assert.equal((await t.post("")).json().step, "done");
    assert.equal((await t.post("/details", DETAILS)).statusCode, 409);
    const pdf = (await t.post("/pdf")).json();
    assert.deepEqual(Buffer.from(pdf.pdf, "base64"), PDF);
    assert.equal(pdf.filename, "Oh-Beef-NDA-James-Robertson-2026-09-27.pdf");
  });

  test("pdf before signing is 404", async () => {
    assert.equal((await t.post("/pdf")).statusCode, 404);
  });

  test("without PLAN_PII_KEY the NDA routes are unavailable", async () => {
    const u = await setup({ withPii: false });
    assert.equal((await u.post("")).statusCode, 503);
  });
});
