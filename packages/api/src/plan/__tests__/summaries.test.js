/**
 * Visit summary + Graph mailer tests. No database, no network, no LLM.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createVisitSweeper, formatDuration, plainText, questionPairs, renderSummaryEmail, snapshotOf, visitDelta } from "../summaries.js";
import { resetGraphTokenCache, sendGraphMail } from "../../email/graph.js";

describe("visit math", () => {
  test("visitDelta subtracts the previous snapshot and sorts by time", () => {
    const prev = { summary: { seconds: 60, interactions: 1, targets: { A: 1 } } };
    const curr = snapshotOf([
      { sectionKey: "summary", seconds: 90, interactions: 1, targets: { A: 3 } },
      { sectionKey: "funding", seconds: 200, interactions: 4, targets: { "Round size": 4 } },
    ]);
    const d = visitDelta(prev, curr);
    assert.equal(d.seconds, 230);
    assert.deepEqual(d.sections.map((s) => s.key), ["funding", "summary"]);
    assert.deepEqual(d.topTargets[0], { section: "funding", label: "Round size", count: 4 });
    assert.deepEqual(d.topTargets[1], { section: "summary", label: "A", count: 2 });
  });

  test("plainText strips Chappy's markdown", () => {
    assert.equal(plainText("**$149,343**, see [Financials](/en/plan/financials)."), "$149,343, see Financials.");
  });

  test("formatDuration", () => {
    assert.equal(formatDuration(42), "42s");
    assert.equal(formatDuration(125), "2m 05s");
    assert.equal(formatDuration(3720), "1h 02m");
  });

  test("questionPairs pairs each question with the following reply", () => {
    const pairs = questionPairs([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1", escalated: true },
      { role: "user", content: "q2" },
      { role: "user", content: "q3" },
      { role: "assistant", content: "a3" },
    ]);
    assert.deepEqual(pairs.map((p) => [p.q, p.a, p.escalated]), [["q1", "a1", true], ["q2", null, false], ["q3", "a3", false]]);
  });

  test("email escapes viewer text", () => {
    const html = renderSummaryEmail({
      code: { id: "c1", label: "<b>Eve</b>", audience: "INVESTOR" },
      verdict: "Tire kicker",
      take: "Meh & more",
      visit: { seconds: 40, sections: [{ key: "summary", seconds: 40, interactions: 0 }], topTargets: [], events: [], pairs: [{ q: "<script>x</script>", a: "no", escalated: false }], start: new Date(), end: new Date(), escalations: 0 },
      env: {},
    });
    assert.ok(!html.includes("<script>x"));
    assert.ok(html.includes("&lt;b&gt;Eve&lt;/b&gt;"));
    assert.ok(html.includes("Meh &amp; more"));
    assert.ok(html.includes("cid:chappy"));
  });
});

function sweeperFixture({ lastSeenAgoMs, seconds = 120, chat = [], prior = null }) {
  const t0 = new Date("2026-09-27T18:00:00Z");
  const now = () => t0;
  const created = [];
  const updated = [];
  const session = {
    id: "s1",
    startedAt: new Date(t0.getTime() - lastSeenAgoMs - seconds * 1000),
    lastSeenAt: new Date(t0.getTime() - lastSeenAgoMs),
    events: [{ type: "scenario", value: "CONSERVATIVE", at: new Date(t0.getTime() - lastSeenAgoMs - 1000).toISOString() }],
    accessCode: { id: "c1", label: "Jim R. - Fund", audience: "INVESTOR" },
    sectionViews: [{ sectionKey: "funding", seconds, interactions: 2, targets: { "Round size": 2 } }],
    visitSummaries: prior ? [prior] : [],
  };
  const prisma = {
    planViewSession: { findMany: async () => [session] },
    planChatMessage: { findMany: async () => chat },
    planVisitSummary: {
      create: async ({ data }) => { const r = { id: `v${created.length + 1}`, ...data }; created.push(r); return r; },
      update: async ({ where, data }) => { updated.push({ where, data }); return { id: where.id, ...data }; },
    },
  };
  const mails = [];
  const sweeper = createVisitSweeper({
    prisma,
    now,
    idleMs: 15 * 60 * 1000,
    env: { PLAN_NOTIFY_EMAIL: "owner@example.com", PLAN_SUMMARY_FROM: "chappy@example.com" },
    summarize: async () => ({ verdict: "Serious investor", take: "Lived in Funding.", subject: "Jim is circling" }),
    sendMail: async (m) => { mails.push(m); return { success: true }; },
    log: { error: () => {} },
  });
  return { sweeper, created, updated, mails, session };
}

describe("visit sweeper", () => {
  test("summarizes an idle visit and emails from chappy@", async () => {
    const f = sweeperFixture({ lastSeenAgoMs: 20 * 60 * 1000, chat: [{ role: "user", content: "What is the pref?", createdAt: new Date() }, { role: "assistant", content: "8%.", createdAt: new Date() }] });
    const [r] = await f.sweeper.sweep();
    assert.equal(r.emailed, true);
    assert.equal(f.mails.length, 1);
    assert.equal(f.mails[0].from, "chappy@example.com");
    assert.equal(f.mails[0].to, "owner@example.com");
    assert.equal(f.mails[0].subject, "Jim is circling");
    assert.match(f.mails[0].html, /Funding and Use of Funds/);
    assert.match(f.mails[0].html, /What is the pref\?/);
    assert.match(f.mails[0].html, /Switched the scenario to CONSERVATIVE/);
    assert.equal(f.created[0].seconds, 120);
    assert.equal(f.created[0].chatCount, 1);
    assert.deepEqual(f.created[0].sections.funding.targets, { "Round size": 2 });
    assert.equal(f.updated[0].data.verdict, "Serious investor");
    assert.ok(f.updated[0].data.emailedAt instanceof Date);
  });

  test("skips a visit that was already summarized", async () => {
    const f = sweeperFixture({ lastSeenAgoMs: 20 * 60 * 1000 });
    f.session.visitSummaries = [{ visitEnd: f.session.lastSeenAt, sections: {} }];
    assert.deepEqual(await f.sweeper.sweep(), []);
    assert.equal(f.mails.length, 0);
  });

  test("a bounce is recorded but not emailed", async () => {
    const f = sweeperFixture({ lastSeenAgoMs: 20 * 60 * 1000, seconds: 12 });
    const [r] = await f.sweeper.sweep();
    assert.equal(r.skipped, true);
    assert.equal(f.created[0].error, "skipped_short");
    assert.equal(f.mails.length, 0);
  });

  test("a return visit is a delta against the previous snapshot", async () => {
    const f = sweeperFixture({
      lastSeenAgoMs: 20 * 60 * 1000,
      seconds: 300,
      prior: { visitEnd: new Date("2026-09-26T10:00:00Z"), sections: { funding: { seconds: 250, interactions: 2, targets: { "Round size": 2 } } } },
    });
    await f.sweeper.sweep();
    assert.equal(f.created[0].seconds, 50);
    assert.equal(f.mails.length, 1);
  });
});

describe("sweeper guard rails", () => {
  test("ignores sessions last seen before PLAN_VISIT_SUMMARIES_SINCE and caps emails per sweep", async () => {
    let where = null;
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`, startedAt: new Date(0), lastSeenAt: new Date("2026-09-27T17:00:00Z"), events: [],
      accessCode: { id: "c", label: "L", audience: "INVESTOR" }, sectionViews: [{ sectionKey: "summary", seconds: 90, interactions: 0 }], visitSummaries: [],
    }));
    const mails = [];
    const sweeper = createVisitSweeper({
      prisma: {
        planViewSession: { findMany: async (q) => { where = q.where; return sessions; } },
        planChatMessage: { findMany: async () => [] },
        planVisitSummary: { create: async ({ data }) => ({ id: "v", ...data }), update: async () => ({}) },
      },
      now: () => new Date("2026-09-27T18:00:00Z"),
      idleMs: 15 * 60 * 1000,
      env: { PLAN_NOTIFY_EMAIL: "o@example.com", PLAN_VISIT_SUMMARIES_SINCE: "2026-09-27T16:30:00Z" },
      summarize: async () => ({ verdict: "v", take: "t", subject: "s" }),
      sendMail: async (m) => { mails.push(m); return { success: true }; },
    });
    await sweeper.sweep();
    assert.equal(where.lastSeenAt.gt.toISOString(), "2026-09-27T16:30:00.000Z");
    assert.equal(mails.length, 5);
  });
});

describe("Graph mailer", () => {
  const env = { MS_TENANT_ID: "t", MS_CLIENT_ID: "c", MS_CLIENT_SECRET: "s", MS_SENDER_EMAIL: "service@example.com" };

  test("not configured returns a reason without calling out", async () => {
    let called = false;
    const r = await sendGraphMail({ to: "a@b.c", subject: "x", html: "y" }, { env: {}, fetchImpl: async () => { called = true; } });
    assert.deepEqual(r, { success: false, reason: "not_configured" });
    assert.equal(called, false);
  });

  test("caches the token and sends inline images", async () => {
    resetGraphTokenCache();
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("login.microsoftonline.com")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      return new Response(null, { status: 202 });
    };
    const msg = { from: "chappy@example.com", to: "owner@example.com", subject: "s", html: "<p>h</p>", inlineImages: [{ contentId: "chappy", name: "c.png", contentType: "image/png", contentBytes: "AAAA" }] };
    assert.deepEqual(await sendGraphMail(msg, { env, fetchImpl }), { success: true });
    assert.deepEqual(await sendGraphMail(msg, { env, fetchImpl }), { success: true });
    assert.equal(calls.filter((c) => c.url.includes("oauth2")).length, 1);
    const send = calls.find((c) => c.url.includes("/users/chappy%40example.com/sendMail"));
    const body = JSON.parse(send.init.body);
    assert.equal(send.init.headers.Authorization, "Bearer tok");
    assert.equal(body.message.attachments[0].isInline, true);
    assert.equal(body.message.toRecipients[0].emailAddress.address, "owner@example.com");
  });

  test("a Graph error is returned, not thrown", async () => {
    resetGraphTokenCache();
    const fetchImpl = async (url) => (url.includes("oauth2") ? new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }) : new Response("ErrorInvalidUser", { status: 404 }));
    const r = await sendGraphMail({ to: "a@b.c", subject: "x", html: "y" }, { env, fetchImpl });
    assert.equal(r.success, false);
    assert.match(r.error, /404/);
  });
});
