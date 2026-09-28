/**
 * Plan invitations: recipient fields, the "Send link by email" route, the
 * invitation copy, the NDA prefill, the NDA copy email after an invitation,
 * and Chappy's first-name context.
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import { registerPlanRoutes } from "../routes.js";
import { registerAdminAuthHooks } from "../../auth/admin-hook.js";
import { createPii } from "../pii.js";
import { deliverNda } from "../nda-delivery.js";
import { renderInviteEmail, renderInviteText, INVITE_SUBJECT } from "../invite-mail.js";
import { greetingName, MISSING_MESSAGE, planEntryUrl, validateRecipient } from "../invite.js";
import { buildMime, resetGraphTokenCache, sendGraphMail } from "../../email/graph.js";
import { makePrismaStub } from "./helpers/prisma-stub.js";

const API_KEY = "k";
const H = { "x-plan-api-key": API_KEY };
const ENV = { SUPPORT_NOTIFY: "live", WEB_BASE_URL: "https://plan.test/", PLAN_NOTIFY_EMAIL: "owner@ohbeef.com" };
const RECIPIENT = { firstName: "Pat", lastName: "Lee", email: "Pat@Lease.com" };

async function build({ env = ENV, sendMail, withAuthHook = false, pii: piiIn } = {}) {
  const prisma = makePrismaStub();
  const pii = piiIn === undefined ? createPii(crypto.randomBytes(32)) : piiIn;
  const mails = [];
  let clock = new Date("2026-09-28T16:00:00Z").getTime();
  const app = Fastify({ logger: false });
  if (withAuthHook) {
    registerAdminAuthHooks(app, {
      requireAdminAuth: async (req, reply) => {
        const role = req.headers["x-test-role"];
        if (!role) return reply.code(401).send({ error: "Unauthorized" });
        req.adminRole = role;
      },
      requireRole: (...roles) => async (req, reply) => {
        if (!roles.includes(req.adminRole)) return reply.code(403).send({ error: "Forbidden" });
      },
    });
  }
  await registerPlanRoutes(app, {
    prisma, apiKey: API_KEY, summaries: false, pii, env,
    now: () => new Date(clock),
    sendSms: async () => ({ success: true }),
    sendMail: sendMail || (async (m) => { mails.push(m); return { success: true }; }),
    deliverNda: () => {},
  });
  await app.ready();
  const req = (method, url, payload, headers = {}) => app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  const issue = async (body = {}) => (await req("POST", "/admin/plan/codes", { label: "Landlord, Lease Co", audience: "LANDLORD", ndaRequired: true, ...body })).json().code;
  return { app, prisma, pii, mails, req, issue, tick: (ms) => { clock += ms; } };
}

describe("recipient fields", () => {
  test("optional on issue, sealed at rest, decrypted for the admin", async () => {
    const t = await build();
    const bare = await t.issue();
    assert.equal(bare.recipient, null);
    const code = await t.issue({ recipientFirstName: " Pat ", recipientLastName: "Lee", recipientEmail: RECIPIENT.email });
    assert.deepEqual(code.recipient, { firstName: "Pat", lastName: "Lee", email: "pat@lease.com" });
    assert.equal(code.invite.url, `https://plan.test/plan?c=${code.code}`);
    assert.ok(!("recipientEmailEnc" in code), "sealed columns never leave the API");
    const row = t.prisma._codes.get(code.id);
    assert.match(row.recipientEmailEnc, /^v1:/);
    assert.ok(!row.recipientEmailEnc.includes("lease.com"));
    const detail = (await t.req("GET", `/admin/plan/codes/${code.id}`)).json().code;
    assert.equal(detail.recipient.firstName, "Pat");
    assert.equal(detail.invite.sentAt, null);
    assert.ok(!("recipientFirstNameEnc" in detail));
  });

  test("editable later, blank clears, a bad email is refused", async () => {
    const t = await build();
    const code = await t.issue();
    const bad = await t.req("PATCH", `/admin/plan/codes/${code.id}/recipient`, { firstName: "Pat", email: "pat@" });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.json().field, "email");
    const ok = await t.req("PATCH", `/admin/plan/codes/${code.id}/recipient`, RECIPIENT);
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.json().code.recipient, { firstName: "Pat", lastName: "Lee", email: "pat@lease.com" });
    const cleared = await t.req("PATCH", `/admin/plan/codes/${code.id}/recipient`, { firstName: "", lastName: "", email: "" });
    assert.equal(cleared.json().code.recipient, null);
    assert.equal((await t.req("PATCH", "/admin/plan/codes/nope/recipient", RECIPIENT)).statusCode, 404);
    const issueBad = await t.req("POST", "/admin/plan/codes", { label: "X", audience: "INVESTOR", recipientEmail: "nope" });
    assert.equal(issueBad.statusCode, 400);
  });

  test("validateRecipient trims and lower-cases the email", () => {
    assert.deepEqual(validateRecipient({ firstName: "  Ana  María ", email: " A@B.CO " }), { ok: true, value: { firstName: "Ana María", lastName: "", email: "a@b.co" } });
  });
});

describe("POST /admin/plan/codes/:id/invite", () => {
  test("refused with a clear error when any recipient field is missing", async () => {
    const t = await build();
    const none = await t.issue();
    const r1 = await t.req("POST", `/admin/plan/codes/${none.id}/invite`, {});
    assert.equal(r1.statusCode, 400);
    assert.equal(r1.json().error, MISSING_MESSAGE);
    assert.deepEqual(r1.json().missing, ["firstName", "lastName", "email"]);
    const partial = await t.issue({ recipientFirstName: "Pat", recipientEmail: "pat@lease.com" });
    const r2 = await t.req("POST", `/admin/plan/codes/${partial.id}/invite`, {});
    assert.equal(r2.statusCode, 400);
    assert.deepEqual(r2.json().missing, ["lastName"]);
    assert.equal(t.mails.length, 0);
    assert.equal(t.prisma._codes.get(partial.id).inviteSentAt ?? null, null);
  });

  test("owner only: managers and signed-out callers are refused", async () => {
    const t = await build({ withAuthHook: true });
    const owner = { "x-test-role": "owner" };
    const created = (await t.req("POST", "/admin/plan/codes", { label: "Pat", audience: "LANDLORD", recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" }, owner)).json().code;
    assert.equal((await t.req("POST", `/admin/plan/codes/${created.id}/invite`, {})).statusCode, 401);
    assert.equal((await t.req("POST", `/admin/plan/codes/${created.id}/invite`, {}, { "x-test-role": "manager" })).statusCode, 403);
    assert.equal((await t.req("POST", `/admin/plan/codes/${created.id}/invite`, {}, { "x-test-role": "station" })).statusCode, 403);
    assert.equal((await t.req("PATCH", `/admin/plan/codes/${created.id}/recipient`, RECIPIENT, { "x-test-role": "manager" })).statusCode, 403);
    assert.equal(t.mails.length, 0);
    assert.equal((await t.req("POST", `/admin/plan/codes/${created.id}/invite`, {}, owner)).statusCode, 200);
    assert.equal(t.mails.length, 1);
  });

  test("sends Chappy's email with the link, records when and to whom, allows a re-send", async () => {
    const t = await build();
    const code = await t.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" });
    const r = await t.req("POST", `/admin/plan/codes/${code.id}/invite`, {});
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().mode, "live");
    const [m] = t.mails;
    assert.equal(m.to, "pat@lease.com");
    assert.equal(m.from, "service@ohbeefnoodlesoup.com");
    assert.equal(m.replyTo, "owner@ohbeef.com");
    assert.equal(m.subject, INVITE_SUBJECT);
    const url = `https://plan.test/plan?c=${code.code}`;
    assert.ok(m.html.includes(`href="${url}"`));
    assert.ok(m.text.includes(url));
    assert.match(m.html, /Hi Pat,/);
    assert.ok(m.inlineImages.some((i) => i.contentId === "chappy"));
    const invite = r.json().code.invite;
    assert.equal(invite.sentTo, "pat@lease.com");
    assert.equal(invite.sendCount, 1);
    assert.ok(invite.sentAt);
    // An immediate double click is held off; a deliberate re-send later goes out.
    assert.equal((await t.req("POST", `/admin/plan/codes/${code.id}/invite`, {})).statusCode, 429);
    t.tick(60_000);
    const again = await t.req("POST", `/admin/plan/codes/${code.id}/invite`, {});
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().code.invite.sendCount, 2);
    assert.equal(t.mails.length, 2);
    const list = (await t.req("GET", "/admin/plan/codes")).json().codes;
    assert.ok(list[0].inviteSentAt || list[1].inviteSentAt);
  });

  test("SUPPORT_NOTIFY=log never emails anyone; off refuses", async () => {
    const t = await build({ env: { ...ENV, SUPPORT_NOTIFY: "log" } });
    const code = await t.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" });
    const r = await t.req("POST", `/admin/plan/codes/${code.id}/invite`, {});
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().mode, "log");
    assert.equal(t.mails.length, 0);
    assert.ok(r.json().code.invite.sentAt);
    const off = await build({ env: { ...ENV, SUPPORT_NOTIFY: "off" } });
    const c2 = await off.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" });
    assert.equal((await off.req("POST", `/admin/plan/codes/${c2.id}/invite`, {})).statusCode, 503);
    assert.equal(off.mails.length, 0);
  });

  test("a failed send is reported and not recorded; revoked codes are refused", async () => {
    const t = await build({ sendMail: async () => ({ success: false, error: "sendMail 500: boom" }) });
    const code = await t.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" });
    const r = await t.req("POST", `/admin/plan/codes/${code.id}/invite`, {});
    assert.equal(r.statusCode, 502);
    assert.match(r.json().error, /did not go out/);
    assert.equal(t.prisma._codes.get(code.id).inviteSentAt ?? null, null);
    await t.req("PATCH", `/admin/plan/codes/${code.id}/revoke`);
    assert.equal((await t.req("POST", `/admin/plan/codes/${code.id}/invite`, {})).statusCode, 409);
  });
});

describe("invitation copy", () => {
  const base = { firstName: "Pat", url: "https://www.ohbeef.com/plan?c=OH-KESTREL-7742", code: "OH-KESTREL-7742", hasAvatar: true, hasLogo: true };
  const visible = (html) => html.replace(/<div style="display:none[^>]*>.*?<\/div>/, "").replace(/<[^>]+>/g, " ");

  test("the link is the one CTA button, with the plain URL as a fallback", () => {
    const html = renderInviteEmail({ ...base, ndaRequired: false });
    const buttons = html.match(/<a [^>]*display:block[^>]*>[^<]*<\/a>/g);
    assert.equal(buttons.length, 1);
    assert.ok(buttons[0].includes(`href="${base.url}"`));
    assert.match(buttons[0], />Open the business plan</);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
    assert.deepEqual([...new Set(hrefs)], [base.url], "every link goes to their plan");
    assert.ok(visible(html).includes(base.url), "plain URL shown");
    assert.match(html, /Hi Pat,/);
    assert.match(html, /I'm Chappy Chopstix, the chopsticks in charge of paperwork/, "Chappy introduces himself here");
    assert.match(html, /excited about your interest in Oh!/);
    assert.match(html, /love your feedback/);
    assert.match(html, /name="viewport"/);
  });

  test("the NDA line appears only when the code requires the NDA", () => {
    const withNda = renderInviteEmail({ ...base, ndaRequired: true });
    const without = renderInviteEmail({ ...base, ndaRequired: false });
    assert.match(visible(withNda), /quick, standard NDA/);
    assert.doesNotMatch(without, /NDA/);
    assert.match(renderInviteText({ ...base, ndaRequired: true }), /quick, standard NDA/);
    assert.doesNotMatch(renderInviteText({ ...base, ndaRequired: false }), /NDA/);
  });

  test("no em dashes, no exclamation points beyond the brand, names escaped", () => {
    for (const ndaRequired of [true, false]) {
      const html = renderInviteEmail({ ...base, ndaRequired });
      const text = renderInviteText({ ...base, ndaRequired });
      assert.ok(!html.includes("—"), "no em dash in the markup");
      for (const s of [visible(html), text, INVITE_SUBJECT]) {
        assert.ok(!s.includes("—"), "no em dash");
        assert.ok(!/!/.test(s.replace(/Oh!/g, "")), "no exclamation points");
      }
      assert.match(text, /^Hi Pat,\n/);
    }
    assert.match(renderInviteEmail({ ...base, firstName: "<b>Al</b>", ndaRequired: false }), /Hi &lt;b&gt;Al&lt;\/b&gt;,/);
  });

  test("planEntryUrl matches the admin's Copy link shape", () => {
    assert.equal(planEntryUrl("OH-KESTREL-7742", { WEB_BASE_URL: "https://www.ohbeef.com/" }), "https://www.ohbeef.com/plan?c=OH-KESTREL-7742");
    assert.equal(planEntryUrl("OH-A-1", {}), "https://www.ohbeef.com/plan?c=OH-A-1");
  });
});

describe("NDA copy email after an invitation", () => {
  const PDF = Buffer.from("%PDF-1.7 executed");
  async function signed(prisma, pii, codeData) {
    const code = await prisma.planAccessCode.create({ data: { code: `OH-NDA-${Math.floor(Math.random() * 9000) + 1000}`, label: "Pat", audience: "LANDLORD", ndaRequired: true, ...codeData } });
    return prisma.planNda.create({
      data: {
        accessCodeId: code.id, status: "SIGNED", version: "2026.09.27", signedAt: new Date("2026-09-28T17:00:00Z"),
        legalNameEnc: pii.seal("Patricia Lee"), emailEnc: pii.seal("pat@lease.com"), phoneEnc: pii.seal("+18015550000"),
        addressEnc: pii.seal(JSON.stringify({ line1: "9 Elm", city: "Provo", region: "UT", postalCode: "84601" })),
        companyEnc: pii.seal(""), titleEnc: pii.seal(""), pdfEnc: pii.sealBytes(PDF), documentSha256: "d".repeat(64),
      },
    });
  }
  test("skips Chappy's introduction when the invitation went out, keeps it otherwise", async () => {
    const prisma = makePrismaStub();
    const pii = createPii(crypto.randomBytes(32));
    const mails = [];
    const deps = { prisma, pii, env: {}, only: "signer", sendMail: async (m) => { mails.push(m); return { success: true }; }, sendSms: async () => ({ success: true }) };
    const invited = await signed(prisma, pii, { inviteSentAt: new Date("2026-09-28T15:00:00Z") });
    const byHand = await signed(prisma, pii, {});
    await deliverNda(invited.id, deps);
    await deliverNda(byHand.id, deps);
    assert.doesNotMatch(mails[0].html, /Chappy Chopstix here/);
    assert.match(mails[0].html, /Your NDA is signed, countersigned, and attached/);
    assert.match(mails[0].html, /Hi Patricia,/);
    assert.match(mails[1].html, /Chappy Chopstix here, the chopsticks in charge of paperwork/);
    assert.equal(mails[0].subject, mails[1].subject);
    assert.equal(mails[0].attachments[0].contentType, "application/pdf");
  });
});

describe("the NDA form prefill and Chappy's first name", () => {
  let t;
  beforeEach(async () => { t = await build(); });
  const enter = async (code) => (await t.req("POST", "/plan/auth", { code: code.code }, H)).json();
  const ndaView = async (sid) => (await t.req("POST", `/plan/sessions/${sid}/nda`, {}, H)).json();

  test("prefills only from the viewer's own code, and only until they save details", async () => {
    const a = await t.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" });
    const b = await t.issue({ recipientFirstName: "Jim", recipientLastName: "Ross", recipientEmail: "jim@bank.com" });
    const c = await t.issue();
    const va = await ndaView((await enter(a)).sid);
    const vb = await ndaView((await enter(b)).sid);
    const vc = await ndaView((await enter(c)).sid);
    assert.deepEqual(va.prefill, { legalName: "Pat Lee", email: "pat@lease.com" });
    assert.deepEqual(vb.prefill, { legalName: "Jim Ross", email: "jim@bank.com" });
    assert.ok(!JSON.stringify(vb).includes("pat@lease.com"), "never another code's recipient");
    assert.equal(vc.prefill, null);
    const sid = (await enter(a)).sid;
    const saved = await t.req("POST", `/plan/sessions/${sid}/nda/details`, {
      legalName: "Patricia Lee", email: "p.lee@lease.com", phone: "(801) 555-0000",
      address: { line1: "9 Elm", city: "Provo", region: "UT", postalCode: "84601" },
    }, H);
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json().prefill, null);
    assert.equal(saved.json().details.legalName, "Patricia Lee", "their edits win");
  });

  test("the auth response carries no recipient data", async () => {
    const a = await t.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com" });
    const body = JSON.stringify(await enter(a));
    assert.ok(!body.includes("Lee") && !body.includes("pat@lease.com") && !body.includes("recipient"));
  });

  test("chat/begin gives Chappy the first name; the signed NDA's name wins", async () => {
    const a = await t.issue({ recipientFirstName: "Pat", recipientLastName: "Lee", recipientEmail: "pat@lease.com", ndaRequired: false });
    const sid = (await enter(a)).sid;
    const begin = (await t.req("POST", `/plan/sessions/${sid}/chat/begin`, { message: "hi" }, H)).json();
    assert.equal(begin.firstName, "Pat");
    assert.equal(begin.contactOnFile, true, "the invitation's email counts as on file");
    await t.prisma.planNda.create({ data: { accessCodeId: a.id, status: "SIGNED", legalNameEnc: t.pii.seal("Patricia Lee"), emailEnc: t.pii.seal("p@lease.com") } });
    const again = (await t.req("POST", `/plan/sessions/${sid}/chat/begin`, { message: "and?" }, H)).json();
    assert.equal(again.firstName, "Patricia");
    const none = await t.issue({ ndaRequired: false });
    const sid2 = (await enter(none)).sid;
    const plain = (await t.req("POST", `/plan/sessions/${sid2}/chat/begin`, { message: "hi" }, H)).json();
    assert.equal(plain.firstName, null);
    assert.equal(plain.contactOnFile, false);
  });

  test("greetingName", () => {
    assert.equal(greetingName({ signedLegalName: "Patricia Lee", recipientFirstName: "Pat" }), "Patricia");
    assert.equal(greetingName({ signedLegalName: null, recipientFirstName: " Pat " }), "Pat");
    assert.equal(greetingName({}), null);
  });
});

describe("sendGraphMail with a text part", () => {
  const env = { MS_TENANT_ID: "t", MS_CLIENT_ID: "c", MS_CLIENT_SECRET: "s", MS_SENDER_EMAIL: "service@x.com" };
  const msg = { from: "service@x.com", fromName: "Oh! Beef Noodle Soup", to: "a@b.com", replyTo: "o@x.com", subject: "Your link", html: "<p>Hi</p>", text: "Hi", inlineImages: [{ contentId: "chappy", name: "chappy.png", contentType: "image/png", contentBytes: "iVBORw0KGgo=" }] };

  test("buildMime has text/plain and text/html alternatives plus the inline image", () => {
    const mime = buildMime(msg, "service@x.com");
    assert.match(mime, /^From: "Oh! Beef Noodle Soup" <service@x\.com>\r\n/);
    assert.match(mime, /\r\nReply-To: <o@x\.com>\r\n/);
    assert.match(mime, /multipart\/related/);
    assert.match(mime, /multipart\/alternative/);
    assert.ok(mime.indexOf("text/plain") < mime.indexOf("text/html"), "plain first, html preferred");
    assert.ok(mime.includes(Buffer.from("Hi", "utf8").toString("base64")));
    assert.match(mime, /Content-ID: <chappy>/);
  });

  test("sends MIME; falls back to the JSON HTML send if Graph refuses it", async () => {
    for (const mimeStatus of [202, 400]) {
      resetGraphTokenCache();
      const calls = [];
      const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
        if (init.headers["Content-Type"] === "text/plain") return new Response("", { status: mimeStatus });
        return new Response("", { status: 202 });
      };
      const r = await sendGraphMail(msg, { env, fetchImpl });
      assert.equal(r.success, true);
      assert.equal(calls[1].init.headers["Content-Type"], "text/plain");
      assert.match(Buffer.from(calls[1].init.body, "base64").toString("utf8"), /Subject: Your link/);
      assert.equal(calls.length, mimeStatus === 202 ? 2 : 3);
      if (mimeStatus === 400) assert.equal(JSON.parse(calls[2].init.body).message.body.contentType, "HTML");
    }
  });
});
