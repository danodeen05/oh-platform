/** Admin NDA routes: countersignature, detail, PDF, resend, void, require toggle. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import { registerPlanRoutes } from "../routes.js";
import { createPii } from "../pii.js";
import { makePrismaStub } from "./helpers/prisma-stub.js";

const PNG = `data:image/png;base64,${Buffer.from("sig").toString("base64")}`;
const PDF = Buffer.from("%PDF-1.7 admin copy");

describe("admin NDA routes", () => {
  let prisma, pii, app, code, nda, mails, texts;
  beforeEach(async () => {
    prisma = makePrismaStub();
    pii = createPii(crypto.randomBytes(32));
    mails = [];
    texts = [];
    app = Fastify({ logger: false });
    await registerPlanRoutes(app, {
      prisma, apiKey: "k", summaries: false, pii,
      sendSms: async (m) => { texts.push(m); return { success: true }; },
      sendMail: async (m) => { mails.push(m); return { success: true }; },
    });
    await app.ready();
    code = await prisma.planAccessCode.create({ data: { code: "OH-NDA-4444", label: "Landlord Co", audience: "LANDLORD", ndaRequired: true } });
    nda = await prisma.planNda.create({
      data: {
        accessCodeId: code.id, status: "SIGNED", version: "2026.09.27", signedAt: new Date("2026-09-27T18:00:00Z"),
        legalNameEnc: pii.seal("Pat Lee"), emailEnc: pii.seal("pat@lease.com"), phoneEnc: pii.seal("+18015550000"),
        addressEnc: pii.seal(JSON.stringify({ line1: "9 Elm", city: "Provo", region: "UT", postalCode: "84601", country: "United States" })),
        companyEnc: pii.seal(""), titleEnc: pii.seal(""), signerIpEnc: pii.seal("198.51.100.4"),
        pdfEnc: pii.sealBytes(PDF), pdfSha256: "e".repeat(64), documentSha256: "f".repeat(64),
      },
    });
  });
  const req = (method, url, payload) => app.inject({ method, url, ...(payload ? { payload } : {}) });

  test("countersignature: validate, save, read back", async () => {
    assert.deepEqual((await req("GET", "/admin/plan/nda/countersigner")).json(), { countersigner: null });
    assert.equal((await req("PUT", "/admin/plan/nda/countersigner", { name: "D", title: "Founder", signature: PNG })).statusCode, 400);
    assert.equal((await req("PUT", "/admin/plan/nda/countersigner", { name: "Dano Deen", title: "Founder", signature: "http://x" })).statusCode, 400);
    const ok = await req("PUT", "/admin/plan/nda/countersigner", { name: "Dano Deen", title: "Founder and CEO", signature: PNG });
    assert.equal(ok.statusCode, 200);
    const got = (await req("GET", "/admin/plan/nda/countersigner")).json().countersigner;
    assert.equal(got.name, "Dano Deen");
    assert.equal(got.signature, PNG);
  });

  test("code NDA detail decrypts for the owner", async () => {
    const r = (await req("GET", `/admin/plan/codes/${code.id}/nda`)).json();
    assert.equal(r.ndaRequired, true);
    assert.equal(r.current.status, "SIGNED");
    assert.equal(r.current.details.legalName, "Pat Lee");
    assert.equal(r.current.audit.ip, "198.51.100.4");
    assert.equal(r.history.length, 1);
    assert.equal((await req("GET", "/admin/plan/codes/nope/nda")).statusCode, 404);
  });

  test("pdf download streams the executed copy", async () => {
    const r = await req("GET", `/admin/plan/ndas/${nda.id}/pdf`);
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers["content-type"], "application/pdf");
    assert.match(r.headers["content-disposition"], /attachment; filename="Oh-Beef-NDA-Pat-Lee-2026-09-27\.pdf"/);
    assert.deepEqual(r.rawPayload, PDF);
  });

  test("resend goes to the signer only", async () => {
    const r = (await req("POST", `/admin/plan/ndas/${nda.id}/resend`, {})).json();
    assert.equal(r.email, true);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, "pat@lease.com");
    assert.equal(texts.length, 1);
  });

  test("void sends the viewer back to sign again; the toggle turns the gate off", async () => {
    const v = await req("POST", `/admin/plan/ndas/${nda.id}/void`, {});
    assert.equal(v.statusCode, 200);
    assert.equal(prisma._ndas[0].status, "VOIDED");
    assert.ok(prisma._ndas[0].voidedAt);
    const list = (await req("GET", "/admin/plan/codes")).json().codes;
    assert.equal(list[0].ndaStatus, "PENDING");
    const off = await req("PATCH", `/admin/plan/codes/${code.id}/nda`, { required: false });
    assert.equal(off.json().code.ndaRequired, false);
    assert.equal((await req("PATCH", `/admin/plan/codes/${code.id}/nda`, { required: "yes" })).statusCode, 400);
  });
});
