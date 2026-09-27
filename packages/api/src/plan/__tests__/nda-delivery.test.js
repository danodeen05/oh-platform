/** NDA delivery: Chappy's email + texts to the signer, copies to the owner. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { deliverNda } from "../nda-delivery.js";
import { renderSignerEmail, signerThanksText, ownerSignedText } from "../nda-mail.js";
import { sendGraphMail, resetGraphTokenCache } from "../../email/graph.js";
import { createPii } from "../pii.js";
import { makePrismaStub } from "./helpers/prisma-stub.js";

const PDF = Buffer.from("%PDF-1.7 executed");
const ENV = { PLAN_NOTIFY_EMAIL: "owner@ohbeef.com", OWNER_ALERT_PHONE: "+15555550100", ADMIN_APP_URL: "https://admin.test" };

async function seed(prisma, pii) {
  const code = await prisma.planAccessCode.create({ data: { code: "OH-NDA-3333", label: "Jim R. - America First CU", audience: "INVESTOR", ndaRequired: true } });
  return prisma.planNda.create({
    data: {
      accessCodeId: code.id,
      status: "SIGNED",
      version: "2026.09.27",
      legalNameEnc: pii.seal("James Robertson"),
      emailEnc: pii.seal("jim@firm.com"),
      phoneEnc: pii.seal("+18015551234"),
      addressEnc: pii.seal(JSON.stringify({ line1: "1 Main St", city: "Lehi", region: "UT", postalCode: "84043", country: "United States" })),
      companyEnc: pii.seal("America First CU"),
      titleEnc: pii.seal("VP"),
      signedAt: new Date("2026-09-27T18:05:00Z"),
      documentSha256: "b".repeat(64),
      pdfEnc: pii.sealBytes(PDF),
      pdfSha256: "c".repeat(64),
    },
  });
}

describe("deliverNda", () => {
  let prisma, pii, mails, texts, nda;
  const deps = (over = {}) => ({
    prisma, pii, env: ENV, log: { error() {}, warn() {} },
    sendMail: async (m) => { mails.push(m); return { success: true }; },
    sendSms: async (m) => { texts.push(m); return { success: true }; },
    ...over,
  });
  beforeEach(async () => {
    prisma = makePrismaStub();
    pii = createPii(crypto.randomBytes(32));
    mails = [];
    texts = [];
    nda = await seed(prisma, pii);
  });

  test("signer gets Chappy's email with the PDF and a thank-you text; owner gets both copies", async () => {
    const r = await deliverNda(nda.id, deps());
    assert.deepEqual(r, { email: true, text: true, owner: true });
    const [signer, owner] = mails;
    assert.equal(signer.from, "service@ohbeefnoodlesoup.com");
    assert.equal(signer.replyTo, "owner@ohbeef.com");
    assert.equal(signer.to, "jim@firm.com");
    assert.equal(signer.subject, "Your signed NDA with Oh! Beef Noodle Soup");
    assert.equal(signer.attachments[0].name, "Oh-Beef-NDA-James-Robertson-2026-09-27.pdf");
    assert.equal(signer.attachments[0].contentType, "application/pdf");
    assert.deepEqual(Buffer.from(signer.attachments[0].contentBytes, "base64"), PDF);
    assert.ok(signer.inlineImages.some((i) => i.contentId === "chappy"));
    assert.match(signer.html, /Hi James,/);
    assert.equal(owner.to, "owner@ohbeef.com");
    assert.equal(owner.subject, "NDA signed: James Robertson (Jim R. - America First CU)");
    assert.equal(owner.attachments.length, 1);
    assert.equal(texts[0].to, "+18015551234");
    assert.equal(texts[0].body, "Oh! Beef Noodle Soup: Thanks for signing, James, and for your interest in Oh!. We received your NDA, and your fully executed copy is in your inbox at j•••@firm.com. Enjoy the plan. Chappy");
    assert.equal(texts[1].to, "+15555550100");
    assert.match(texts[1].body, /^Chappy: Jim R\. - America First CU just signed the NDA as James Robertson\. PDF's in your inbox\. https:\/\/admin\.test\/plan-access\//);
    const row = prisma._ndas[0];
    assert.ok(row.emailedAt && row.textedAt && row.ownerNotifiedAt);
    assert.equal(row.deliveryError, null);
  });

  test("an email failure still texts, says on its way, and records the error", async () => {
    let n = 0;
    const r = await deliverNda(nda.id, deps({ sendMail: async (m) => { mails.push(m); n += 1; return n === 1 ? { success: false, error: "sendMail 500" } : { success: true }; } }));
    assert.equal(r.email, false);
    assert.match(texts[0].body, /is on its way to j•••@firm\.com/);
    const row = prisma._ndas[0];
    assert.ok(!row.emailedAt);
    assert.match(row.deliveryError, /signer email: sendMail 500/);
  });

  test("resend to the signer only skips the owner", async () => {
    await deliverNda(nda.id, deps({ only: "signer" }));
    assert.equal(mails.length, 1);
    assert.equal(texts.length, 1);
  });

  test("drafts and unknown ids are ignored", async () => {
    await prisma.planNda.update({ where: { id: nda.id }, data: { status: "DRAFT" } });
    assert.deepEqual(await deliverNda(nda.id, deps()), { skipped: true });
    assert.deepEqual(await deliverNda("nope", deps()), { skipped: true });
    assert.equal(mails.length + texts.length, 0);
  });

  test("copy has no em dashes or exclamation points beyond the brand name", () => {
    const html = renderSignerEmail({ firstName: "James", legalName: "James Robertson", signedAt: new Date(), ndaId: "n1", version: "v", documentSha256: "d".repeat(64), hasAvatar: true, hasLogo: true });
    const text = html.replace(/<[^>]+>/g, " ");
    assert.ok(!/—/.test(html));
    assert.ok(!/!(?! Beef)/.test(text.replace(/Oh!/g, "")), "no exclamation points");
    assert.ok(!/—/.test(signerThanksText({ first: "A", masked: "a@b.c", emailed: true })));
    assert.ok(!/—/.test(ownerSignedText({ label: "L", legalName: "N", url: "u" })));
  });
});

describe("sendGraphMail attachments", () => {
  test("adds replyTo and non-inline file attachments", async () => {
    resetGraphTokenCache();
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      return new Response("", { status: 202 });
    };
    const env = { MS_TENANT_ID: "t", MS_CLIENT_ID: "c", MS_CLIENT_SECRET: "s", MS_SENDER_EMAIL: "service@x.com" };
    const r = await sendGraphMail({ to: "a@b.com", subject: "s", html: "<p>h</p>", replyTo: "o@x.com", attachments: [{ name: "a.pdf", contentType: "application/pdf", contentBytes: "JVBERg==" }] }, { env, fetchImpl });
    assert.equal(r.success, true);
    const body = JSON.parse(calls[1].init.body);
    assert.deepEqual(body.message.replyTo, [{ emailAddress: { address: "o@x.com" } }]);
    assert.equal(body.message.attachments[0].isInline, false);
    assert.equal(body.message.attachments[0].name, "a.pdf");
  });
});
