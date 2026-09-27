/**
 * Task A9: support cases (public create, staff list/resolve) and case
 * notifications. Staff may give store credit or refund an ENTIRE order to the
 * card, never a partial card refund. Real Fastify injects against the plugin
 * index.js registers.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { registerSupportRoutes, notifyCase, notifyMode } from "../routes.js";

const NOW = new Date("2026-10-01T12:00:00-06:00");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ENV = { SUPPORT_NOTIFY: "live", ADMIN_PHONE_NUMBER: "+18015550100", PLAN_NOTIFY_EMAIL: "owner@example.com" };

function fakeStripe({ failCreate = false } = {}) {
  const issued = [];
  const createCalls = [];
  return {
    issued,
    createCalls,
    refunds: {
      async list({ payment_intent }) {
        return { data: issued.filter((r) => r.payment_intent === payment_intent) };
      },
      async create(params, options) {
        createCalls.push([params, options]);
        if (failCreate) throw new Error("stripe down");
        // Stripe dedups on the idempotency key.
        const prior = issued.find((r) => r.key === options?.idempotencyKey);
        if (prior) return prior;
        const refund = { id: `re_${issued.length + 1}`, payment_intent: params.payment_intent, key: options?.idempotencyKey };
        issued.push(refund);
        return refund;
      },
    },
  };
}

const fakeCustomerAuth = {
  async resolve(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer test:")) return { kind: "user", userId: h.slice(12), email: "x@x.com" };
    if (h === "Bearer guest") return { kind: "guest", guestKey: "gk1" };
    return { kind: "anonymous" };
  },
  isServiceCall: (req) => req.headers["x-admin-api-key"] === "svc",
};

function seedDb(extra = {}) {
  return makeMemoryPrisma({
    users: [
      { id: "u1", email: "u1@x.com", creditsCents: 0 },
      { id: "u2", email: "u2@x.com", creditsCents: 0 },
    ],
    orders: [
      { id: "o1", userId: "u1", paymentStatus: "PAID", status: "COMPLETED", totalCents: 1924, amountDueCents: 1924, stripePaymentId: "pi_1", createdAt: new Date(NOW.getTime() - HOUR) },
      { id: "o3", userId: "u2", paymentStatus: "PAID", status: "COMPLETED", totalCents: 1500, amountDueCents: 1500, stripePaymentId: "pi_3", createdAt: new Date(NOW.getTime() - HOUR) },
    ],
    ...extra,
  });
}

function spies({ smsThrows = false, mailThrows = false } = {}) {
  const sms = [];
  const mail = [];
  return {
    sms,
    mail,
    sendSMS: async (m) => {
      sms.push(m);
      if (smsThrows) throw new Error("twilio down");
      return { success: true };
    },
    sendGraphMail: async (m) => {
      mail.push(m);
      if (mailThrows) throw new Error("graph down");
      return { success: true };
    },
  };
}

async function buildApp({ prisma = seedDb(), stripe = fakeStripe(), env = ENV, requireOwner, requireAdminAuth, notify = spies(), clock } = {}) {
  const app = Fastify({ logger: false });
  let t = NOW.getTime();
  const now = clock || (() => new Date(t));
  await registerSupportRoutes(app, {
    prisma,
    stripe,
    customerAuth: fakeCustomerAuth,
    sendSMS: notify.sendSMS,
    sendGraphMail: notify.sendGraphMail,
    env,
    now,
    ...(requireOwner ? { requireOwner } : {}),
    ...(requireAdminAuth ? { requireAdminAuth } : {}),
    log: () => {},
  });
  await app.ready();
  return { app, prisma, stripe, notify, advance: (ms) => (t += ms) };
}

let ipSeq = 0;
const freshIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
const post = (app, payload, { headers = {}, ip = freshIp() } = {}) => app.inject({ method: "POST", url: "/support/cases", payload, headers, remoteAddress: ip });

describe("notifyCase", () => {
  test("an urgent case sends one SMS and one email", async () => {
    const n = spies();
    const r = await notifyCase({ ...n, env: ENV, log: () => {} }, { id: "c1", type: "POD_ISSUE", summary: "Pod B-07 is wet", amountCents: null }, { urgent: true });
    assert.equal(n.sms.length, 1);
    assert.equal(n.sms[0].to, "+18015550100");
    assert.equal(n.mail.length, 1);
    assert.deepEqual(n.mail[0].to, ["owner@example.com"]);
    assert.deepEqual(r, { sms: "sent", email: "sent" });
  });

  test("SMS when amount >= $20; email always", async () => {
    let n = spies();
    await notifyCase({ ...n, env: ENV }, { id: "c1", type: "REFUND_REQUEST", summary: "x", amountCents: 2000 }, { urgent: false });
    assert.deepEqual([n.sms.length, n.mail.length], [1, 1]);
    n = spies();
    await notifyCase({ ...n, env: ENV }, { id: "c1", type: "REFUND_REQUEST", summary: "x", amountCents: 1999 }, { urgent: false });
    assert.deepEqual([n.sms.length, n.mail.length], [0, 1]);
  });

  test("SUPPORT_NOTIFY=log sends nothing and logs the would-be messages; off sends and logs nothing; unset means live", async () => {
    let n = spies();
    const lines = [];
    const r = await notifyCase({ ...n, env: { ...ENV, SUPPORT_NOTIFY: "log" }, log: (l) => lines.push(l) }, { id: "c1", type: "POD_ISSUE", summary: "x" }, { urgent: true });
    assert.deepEqual([n.sms.length, n.mail.length], [0, 0]);
    assert.deepEqual(r, { sms: "logged", email: "logged" });
    assert.equal(lines.length, 2);
    n = spies();
    const off = await notifyCase({ ...n, env: { ...ENV, SUPPORT_NOTIFY: "off" }, log: (l) => lines.push(l) }, { id: "c1", type: "POD_ISSUE", summary: "x" }, { urgent: true });
    assert.deepEqual([n.sms.length, n.mail.length, lines.length], [0, 0, 2]);
    assert.deepEqual(off, { sms: "off", email: "off" });
    assert.equal(notifyMode({}), "live");
    assert.equal(notifyMode({ SUPPORT_NOTIFY: "LOG" }), "log");
    assert.equal(notifyMode({ SUPPORT_NOTIFY: "nonsense" }), "log", "an unknown value never goes live");
  });

  test("falls back to OWNER_EMAIL, and a failing sender never throws", async () => {
    const n = spies({ smsThrows: true, mailThrows: true });
    const r = await notifyCase({ ...n, env: { SUPPORT_NOTIFY: "live", ADMIN_PHONE_NUMBER: "+18015550100", OWNER_EMAIL: "o@example.com" }, log: () => {} }, { id: "c1", type: "GENERAL", summary: "<b>hi</b>" }, { urgent: true });
    assert.deepEqual(n.mail[0].to, ["o@example.com"]);
    assert.doesNotMatch(n.mail[0].html, /<b>hi<\/b>/, "summary is escaped");
    assert.deepEqual(r, { sms: "failed", email: "failed" });
  });
});

describe("POST /support/cases", () => {
  test("anonymous contact form: creates the case and emails the owner (no SMS)", async () => {
    const { app, prisma, notify } = await buildApp();
    const res = await post(app, { type: "CONTACT", summary: "Do you cater?", contact: { email: "a@b.co", name: "Ann" }, locale: "es" });
    assert.equal(res.statusCode, 200);
    const { caseId } = res.json();
    const c = await prisma.supportCase.findUnique({ where: { id: caseId } });
    assert.equal(c.userId, null);
    assert.equal(c.status, "OPEN");
    assert.equal(c.locale, "es");
    assert.deepEqual(c.contact, { email: "a@b.co", name: "Ann" });
    assert.deepEqual([notify.sms.length, notify.mail.length], [0, 1]);
  });

  test("the customer comes from auth, never from the body; an owned order is linked with its amount", async () => {
    const { app, prisma } = await buildApp();
    const res = await post(app, { type: "ORDER_ISSUE", summary: "Soup was cold", orderId: "o1", userId: "u2", locale: "en" }, { headers: { authorization: "Bearer test:u1" } });
    assert.equal(res.statusCode, 200);
    const c = await prisma.supportCase.findUnique({ where: { id: res.json().caseId } });
    assert.equal(c.userId, "u1");
    assert.equal(c.orderId, "o1");
    assert.equal(c.amountCents, 1924);
  });

  test("an order the caller does not own is refused, for members, guests and anonymous callers", async () => {
    const { app, prisma } = await buildApp();
    const a = await post(app, { type: "ORDER_ISSUE", summary: "x", orderId: "o3" }, { headers: { authorization: "Bearer test:u1" } });
    assert.equal(a.statusCode, 403);
    const b = await post(app, { type: "ORDER_ISSUE", summary: "x", orderId: "o1", contact: { email: "a@b.co" } });
    assert.equal(b.statusCode, 403);
    const c = await post(app, { type: "ORDER_ISSUE", summary: "x", orderId: "o1", contact: { email: "a@b.co" } }, { headers: { authorization: "Bearer guest" } });
    assert.equal(c.statusCode, 403);
    const d = await post(app, { type: "ORDER_ISSUE", summary: "x", orderId: "nope" }, { headers: { authorization: "Bearer test:u1" } });
    assert.equal(d.statusCode, 403);
    assert.equal((await prisma.supportCase.findMany()).length, 0);
  });

  test("validation: type, summary length, contact for anonymous callers, locale, transcript size", async () => {
    const { app, prisma } = await buildApp();
    const bad = [
      { type: "NOPE", summary: "x", contact: { email: "a@b.co" } },
      { summary: "x", contact: { email: "a@b.co" } },
      { type: "GENERAL", summary: "", contact: { email: "a@b.co" } },
      { type: "GENERAL", summary: "   ", contact: { email: "a@b.co" } },
      { type: "GENERAL", summary: "x".repeat(2001), contact: { email: "a@b.co" } },
      { type: "GENERAL", summary: 42, contact: { email: "a@b.co" } },
      { type: "GENERAL", summary: "x" },
      { type: "GENERAL", summary: "x", contact: {} },
      { type: "GENERAL", summary: "x", contact: { email: "not-an-email" } },
      { type: "GENERAL", summary: "x", contact: { phone: "12" } },
      { type: "GENERAL", summary: "x", contact: "a@b.co" },
      { type: "GENERAL", summary: "x", contact: { email: "a@b.co" }, locale: "klingon" },
      { type: "GENERAL", summary: "x", contact: { email: "a@b.co" }, transcript: "y".repeat(60001) },
      { type: "GENERAL", summary: "x", contact: { email: "a@b.co" }, orderId: 7 },
    ];
    for (const payload of bad) {
      const res = await post(app, payload);
      assert.equal(res.statusCode, 400, JSON.stringify(payload).slice(0, 120));
    }
    assert.equal((await post(app, "not json", { headers: { "content-type": "text/plain" } })).statusCode, 400);
    assert.equal((await prisma.supportCase.findMany()).length, 0);
    assert.equal((await post(app, { type: "GENERAL", summary: "x".repeat(2000), contact: { phone: "(801) 555-0100" } })).statusCode, 200);
    assert.equal((await post(app, { type: "GENERAL", summary: "signed in, no contact" }, { headers: { authorization: "Bearer test:u1" } })).statusCode, 200);
  });

  test("honeypot: a filled `website` gets a 200 and the case is silently dropped", async () => {
    const { app, prisma, notify } = await buildApp();
    const res = await post(app, { type: "CONTACT", summary: "Buy cheap watches", contact: { email: "bot@spam.co" }, website: "http://spam.co" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
    assert.equal((await prisma.supportCase.findMany()).length, 0);
    assert.deepEqual([notify.sms.length, notify.mail.length], [0, 0]);
  });

  test("rate limit: 5 per hour per IP for anonymous callers, per identity for members; resets after the hour", async () => {
    const { app, advance } = await buildApp();
    const payload = { type: "CONTACT", summary: "hi", contact: { email: "a@b.co" } };
    for (let i = 0; i < 5; i++) assert.equal((await post(app, payload, { ip: "1.2.3.4" })).statusCode, 200);
    assert.equal((await post(app, payload, { ip: "1.2.3.4" })).statusCode, 429);
    assert.equal((await post(app, payload, { ip: "1.2.3.5" })).statusCode, 200, "another IP has its own bucket");

    const member = { headers: { authorization: "Bearer test:u1" } };
    for (let i = 0; i < 5; i++) assert.equal((await post(app, { type: "GENERAL", summary: "m" }, { ...member, ip: freshIp() })).statusCode, 200);
    assert.equal((await post(app, { type: "GENERAL", summary: "m" }, { ...member, ip: freshIp() })).statusCode, 429, "a member cannot dodge the limit by changing IP");

    advance(HOUR + 1000);
    assert.equal((await post(app, payload, { ip: "1.2.3.4" })).statusCode, 200);
  });

  test("rate limit behind a proxy: keyed on the hop the proxy appended, not a client-forged left entry", async () => {
    const { app } = await buildApp();
    const payload = { type: "CONTACT", summary: "hi", contact: { email: "a@b.co" } };
    const proxy = "10.9.9.9"; // every request arrives from the same proxy address
    for (let i = 0; i < 5; i++) {
      const res = await post(app, payload, { ip: proxy, headers: { "x-forwarded-for": `6.6.6.${i}, 203.0.113.7` } });
      assert.equal(res.statusCode, 200);
    }
    assert.equal((await post(app, payload, { ip: proxy, headers: { "x-forwarded-for": "7.7.7.7, 203.0.113.7" } })).statusCode, 429, "forging the left entry does not reset the bucket");
    assert.equal((await post(app, payload, { ip: proxy, headers: { "x-forwarded-for": "203.0.113.8" } })).statusCode, 200, "a different client behind the same proxy has its own bucket");
  });

  test("a notify failure never fails case creation", async () => {
    const { app, prisma } = await buildApp({ notify: spies({ smsThrows: true, mailThrows: true }) });
    const res = await post(app, { type: "POD_ISSUE", summary: "x", contact: { email: "a@b.co" } });
    assert.equal(res.statusCode, 200);
    assert.equal((await prisma.supportCase.findMany()).length, 1);
  });

  test("`urgent` from the body is ignored for customers and honored for trusted service calls", async () => {
    let b = await buildApp();
    await post(b.app, { type: "POD_ISSUE", summary: "x", contact: { email: "a@b.co" }, urgent: true });
    assert.deepEqual([b.notify.sms.length, b.notify.mail.length], [0, 1]);
    b = await buildApp();
    await post(b.app, { type: "POD_ISSUE", summary: "x", contact: { email: "a@b.co" }, urgent: true }, { headers: { "x-admin-api-key": "svc" } });
    assert.deepEqual([b.notify.sms.length, b.notify.mail.length], [1, 1]);
  });
});

describe("GET /admin/support/cases", () => {
  test("lists cases newest first, filtered by status; a bad status is 400", async () => {
    const prisma = seedDb({
      supportCases: [
        { id: "c1", type: "GENERAL", status: "OPEN", summary: "a", createdAt: new Date(NOW.getTime() - 2 * HOUR) },
        { id: "c2", type: "GENERAL", status: "RESOLVED", summary: "b", createdAt: new Date(NOW.getTime() - HOUR) },
        { id: "c3", type: "GENERAL", status: "OPEN", summary: "c", createdAt: new Date(NOW.getTime() - 30 * 60000) },
      ],
    });
    const { app } = await buildApp({ prisma });
    const open = await app.inject({ method: "GET", url: "/admin/support/cases?status=OPEN" });
    assert.equal(open.statusCode, 200);
    assert.deepEqual(open.json().cases.map((c) => c.id), ["c3", "c1"]);
    const all = await app.inject({ method: "GET", url: "/admin/support/cases" });
    assert.deepEqual(all.json().cases.map((c) => c.id), ["c3", "c2", "c1"]);
    assert.equal((await app.inject({ method: "GET", url: "/admin/support/cases?status=bogus" })).statusCode, 400);
  });

  test("admin routes run requireAdminAuth when it is given", async () => {
    const deny = async (req, reply) => reply.code(401).send({ error: "no" });
    const { app, stripe } = await buildApp({ requireAdminAuth: deny });
    assert.equal((await app.inject({ method: "GET", url: "/admin/support/cases" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/admin/support/cases/c1/resolve", payload: { action: "full_refund" } })).statusCode, 401);
    assert.equal(stripe.createCalls.length, 0);
  });
});

describe("POST /admin/support/cases/:id/resolve", () => {
  const resolve = (app, id, payload) => app.inject({ method: "POST", url: `/admin/support/cases/${id}/resolve`, payload });

  function refundFixture({ order = {}, reward = {}, mealGift = {}, giftCard = {}, extraOrders = [] } = {}) {
    return seedDb({
      orders: [
        {
          id: "o1", userId: "u1", paymentStatus: "PAID", status: "COMPLETED", totalCents: 2500, amountDueCents: 800, stripePaymentId: "pi_1",
          creditsAppliedCents: 300, rewardId: "r1", rewardDiscountCents: 1599, giftCardId: "gc1", giftCardAppliedCents: 700,
          mealGiftId: "mg1", mealGiftAppliedCents: 500, createdAt: new Date(NOW.getTime() - HOUR), ...order,
        },
        ...extraOrders,
      ],
      rewards: [{ id: "r1", userId: "u1", type: "FREE_BOWL", issuedFor: "tier:NOODLE_MASTER", windowEndsAt: new Date(NOW.getTime() + 5 * DAY), redeemedOrderId: "o1", redeemedAt: new Date(NOW.getTime() - HOUR), ...reward }],
      giftCards: [{ id: "gc1", code: "AAAA-BBBB-CCCC-DDDD", amountCents: 700, balanceCents: 0, status: "EXHAUSTED", ...giftCard }],
      mealGifts: [{ id: "mg1", giverId: "u2", locationId: "L1", amountCents: 500, status: "ACCEPTED", acceptedById: "u1", orderId: "o1", acceptedAt: new Date(NOW.getTime() - HOUR), paidAt: new Date(NOW.getTime() - DAY), expiresAt: new Date(NOW.getTime() + 6 * HOUR), ...mealGift }],
      supportCases: [
        { id: "c1", userId: "u1", orderId: "o1", type: "REFUND_REQUEST", status: "OPEN", summary: "wrong order" },
        { id: "c2", userId: "u1", orderId: "o1", type: "ORDER_ISSUE", status: "OPEN", summary: "same order again" },
        { id: "cAnon", userId: null, type: "CONTACT", status: "OPEN", summary: "anon" },
      ],
    });
  }

  test("full_refund with amountCents is 400 PARTIAL_REFUND_NOT_ALLOWED and moves no money", async () => {
    const { app, prisma, stripe } = await buildApp({ prisma: refundFixture() });
    for (const amountCents of [500, 800, 0, null, "800"]) {
      const res = await resolve(app, "c1", { action: "full_refund", amountCents });
      assert.equal(res.statusCode, 400, String(amountCents));
      assert.equal(res.json().code, "PARTIAL_REFUND_NOT_ALLOWED");
    }
    assert.equal((await resolve(app, "c1", { action: "full_refund", amount: 500 })).json().code, "PARTIAL_REFUND_NOT_ALLOWED");
    assert.equal(stripe.createCalls.length, 0);
    assert.equal((await prisma.supportCase.findUnique({ where: { id: "c1" } })).status, "OPEN");
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PAID");
  });

  test("full_refund refunds the PaymentIntent with NO amount key, then restores every tender the order used", async () => {
    const { app, prisma, stripe } = await buildApp({ prisma: refundFixture() });
    const res = await resolve(app, "c1", { action: "full_refund", reason: "wrong bowl" });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(stripe.createCalls.length, 1);
    const [params, options] = stripe.createCalls[0];
    assert.deepEqual(params, { payment_intent: "pi_1" });
    assert.equal("amount" in params, false);
    assert.equal(options.idempotencyKey, "order-refund-pi_1", "shares the A6 per-PaymentIntent key");

    const order = await prisma.order.findUnique({ where: { id: "o1" } });
    assert.equal(order.paymentStatus, "REFUNDED");

    // (a) credit: an ADMIN lot "refund restore" and a REFUND_RESTORE event
    const lots = await prisma.creditLot.findMany({ where: { userId: "u1" } });
    assert.deepEqual(lots.map((l) => [l.source, l.amountCents, l.note, l.orderId]), [["ADMIN", 300, "refund restore", "o1"]]);
    const events = await prisma.creditEvent.findMany({ where: { userId: "u1" } });
    assert.deepEqual(events.map((e) => [e.type, e.amountCents]), [["REFUND_RESTORE", 300]]);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 300);
    // (b) gift card balance back, reactivated
    const card = await prisma.giftCard.findUnique({ where: { id: "gc1" } });
    assert.deepEqual([card.balanceCents, card.status], [700, "ACTIVE"]);
    // (c) reward window still open: un-redeemed
    const reward = await prisma.reward.findUnique({ where: { id: "r1" } });
    assert.deepEqual([reward.redeemedAt, reward.redeemedOrderId], [null, null]);
    // (d) meal gift not expired: back to PENDING
    const gift = await prisma.mealGift.findUnique({ where: { id: "mg1" } });
    assert.deepEqual([gift.status, gift.orderId, gift.acceptedById], ["PENDING", null, null]);
    // the case records it
    const c = await prisma.supportCase.findUnique({ where: { id: "c1" } });
    assert.equal(c.status, "RESOLVED");
    assert.equal(c.resolution, "FULL_REFUND");
    assert.equal(c.amountCents, 800);
    assert.ok(c.resolvedBy);
    assert.equal(c.resolvedAt.getTime(), NOW.getTime());
    assert.equal(c.resolutionDetail.refundId, "re_1");
    assert.equal(c.resolutionNote, "wrong bowl");
  });

  test("a reward whose window closed is re-issued for 30 days; an expired meal gift is left used", async () => {
    const prisma = refundFixture({
      reward: { windowEndsAt: new Date(NOW.getTime() - DAY) },
      mealGift: { expiresAt: new Date(NOW.getTime() - HOUR) },
    });
    const { app } = await buildApp({ prisma });
    assert.equal((await resolve(app, "c1", { action: "full_refund" })).statusCode, 200);
    const rewards = await prisma.reward.findMany({ where: { userId: "u1" } });
    assert.equal(rewards.length, 2);
    const reissued = rewards.find((r) => r.id !== "r1");
    assert.equal(reissued.type, "FREE_BOWL");
    assert.equal(reissued.redeemedAt ?? null, null);
    assert.equal(reissued.windowEndsAt.getTime(), NOW.getTime() + 30 * DAY);
    assert.equal((await prisma.reward.findUnique({ where: { id: "r1" } })).redeemedOrderId, "o1", "the used one stays used");
    assert.equal((await prisma.mealGift.findUnique({ where: { id: "mg1" } })).status, "ACCEPTED");
    const c = await prisma.supportCase.findUnique({ where: { id: "c1" } });
    assert.equal(c.resolutionDetail.restores.mealGift, "EXPIRED_NOT_RESTORED");
    assert.equal(c.resolutionDetail.restores.reward, "REISSUED");
  });

  test("idempotent: resolving twice refunds and restores once", async () => {
    const { app, prisma, stripe } = await buildApp({ prisma: refundFixture() });
    assert.equal((await resolve(app, "c1", { action: "full_refund" })).statusCode, 200);
    const again = await resolve(app, "c1", { action: "full_refund" });
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().alreadyResolved, true);
    assert.equal(stripe.createCalls.length, 1);
    assert.equal((await prisma.creditLot.findMany()).length, 1);
    assert.equal((await prisma.giftCard.findUnique({ where: { id: "gc1" } })).balanceCents, 700);
  });

  test("concurrent double-click: one refund call, one set of restores", async () => {
    const { app, prisma, stripe } = await buildApp({ prisma: refundFixture() });
    const rs = await Promise.all([1, 2, 3].map(() => resolve(app, "c1", { action: "full_refund" })));
    assert.deepEqual(rs.map((r) => r.statusCode), [200, 200, 200]);
    assert.equal(stripe.createCalls.length, 1);
    assert.equal((await prisma.creditLot.findMany()).length, 1);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 300);
  });

  test("a second case for an already refunded order is 409 and moves nothing", async () => {
    const { app, prisma, stripe } = await buildApp({ prisma: refundFixture() });
    assert.equal((await resolve(app, "c1", { action: "full_refund" })).statusCode, 200);
    const second = await resolve(app, "c2", { action: "full_refund" });
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().code, "ALREADY_REFUNDED");
    assert.equal(stripe.createCalls.length, 1);
    assert.equal((await prisma.creditLot.findMany()).length, 1);
    assert.equal((await prisma.supportCase.findUnique({ where: { id: "c2" } })).status, "OPEN");
  });

  test("a PaymentIntent shared with other orders (kiosk batch, group) is 409: a whole-PI refund would refund someone else", async () => {
    const prisma = refundFixture({ extraOrders: [{ id: "o9", userId: "u2", paymentStatus: "PAID", stripePaymentId: "pi_1", totalCents: 1000, amountDueCents: 1000 }] });
    const { app, stripe } = await buildApp({ prisma });
    const res = await resolve(app, "c1", { action: "full_refund" });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, "SHARED_PAYMENT");
    assert.equal(stripe.createCalls.length, 0);
  });

  test("Stripe failure: 502, case stays OPEN, order stays PAID, nothing restored; a retry then succeeds", async () => {
    const prisma = refundFixture();
    const failing = await buildApp({ prisma, stripe: fakeStripe({ failCreate: true }) });
    const res = await resolve(failing.app, "c1", { action: "full_refund" });
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().code, "REFUND_FAILED");
    assert.equal((await prisma.supportCase.findUnique({ where: { id: "c1" } })).status, "OPEN");
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PAID");
    assert.equal((await prisma.creditLot.findMany()).length, 0);
    const ok = await buildApp({ prisma });
    assert.equal((await resolve(ok.app, "c1", { action: "full_refund" })).statusCode, 200);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "REFUNDED");
  });

  test("an unpaid order, or a case with no order, cannot be refunded", async () => {
    const { app, stripe } = await buildApp({ prisma: refundFixture({ order: { paymentStatus: "PENDING" } }) });
    assert.equal((await resolve(app, "c1", { action: "full_refund" })).json().code, "ORDER_NOT_PAID");
    assert.equal((await resolve(app, "cAnon", { action: "full_refund" })).json().code, "NO_ORDER");
    assert.equal(stripe.createCalls.length, 0);
  });

  test("an order paid entirely by store tenders (no card) is refunded by restoring them, with no Stripe call", async () => {
    const prisma = refundFixture({ order: { stripePaymentId: null, amountDueCents: 0 } });
    const { app, stripe } = await buildApp({ prisma });
    assert.equal((await resolve(app, "c1", { action: "full_refund" })).statusCode, 200);
    assert.equal(stripe.createCalls.length, 0);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "REFUNDED");
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 300);
  });

  test("full_refund goes through the injectable owner check; credit and decline do not", async () => {
    const seen = [];
    const requireOwner = async (req, reply) => {
      seen.push(req.url);
      return reply.code(403).send({ error: "Owner only" });
    };
    const { app, stripe, prisma } = await buildApp({ prisma: refundFixture(), requireOwner });
    assert.equal((await resolve(app, "c1", { action: "full_refund" })).statusCode, 403);
    assert.equal(stripe.createCalls.length, 0);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PAID");
    assert.equal((await resolve(app, "c1", { action: "credit", amountCents: 100 })).statusCode, 200);
    assert.equal((await resolve(app, "c2", { action: "decline", reason: "no" })).statusCode, 200);
    assert.equal(seen.length, 1);
  });

  test("credit: an ADMIN CreditLot, no Stripe, no goodwill caps, resolvedBy logged", async () => {
    const lifetimeUsed = Array.from({ length: 10 }, (_, i) => ({ userId: "u1", source: "GOODWILL", amountCents: 450, remainingCents: 0, expiresAt: new Date(NOW.getTime() - DAY), orderId: `h${i}`, createdAt: new Date(NOW.getTime() - (5 + i) * DAY) }));
    const prisma = refundFixture();
    for (const l of lifetimeUsed) await prisma.creditLot.create({ data: l });
    const { app, stripe } = await buildApp({ prisma });
    const res = await resolve(app, "c1", { action: "credit", amountCents: 2500, reason: "big mess" });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(stripe.createCalls.length, 0);
    const lots = await prisma.creditLot.findMany({ where: { userId: "u1", source: "ADMIN" } });
    assert.deepEqual(lots.map((l) => [l.amountCents, l.remainingCents, l.expiresAt.getTime()]), [[2500, 2500, NOW.getTime() + 90 * DAY]]);
    const c = await prisma.supportCase.findUnique({ where: { id: "c1" } });
    assert.deepEqual([c.status, c.resolution, c.amountCents, c.resolutionNote], ["RESOLVED", "STAFF_CREDIT", 2500, "big mess"]);
    assert.ok(c.resolvedBy);
    assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PAID");
  });

  test("credit: the amount must be a positive integer up to $500", async () => {
    const { app, prisma } = await buildApp({ prisma: refundFixture() });
    for (const amountCents of [0, -500, 1.5, 50001, "100", null, undefined]) {
      const res = await resolve(app, "c1", { action: "credit", amountCents });
      assert.equal(res.statusCode, 400, String(amountCents));
      assert.equal(res.json().code, "INVALID_AMOUNT");
    }
    assert.equal((await resolve(app, "c1", { action: "credit", amountCents: 50000 })).statusCode, 200);
    assert.equal((await prisma.creditLot.findMany()).length, 1);
  });

  test("credit: a case with no member is 409; concurrent credits on one case grant once", async () => {
    const { app, prisma } = await buildApp({ prisma: refundFixture() });
    assert.equal((await resolve(app, "cAnon", { action: "credit", amountCents: 100 })).json().code, "NO_MEMBER");
    const rs = await Promise.all([1, 2].map(() => resolve(app, "c1", { action: "credit", amountCents: 100 })));
    assert.deepEqual(rs.map((r) => r.statusCode), [200, 200]);
    assert.equal((await prisma.creditLot.findMany()).length, 1);
  });

  test("decline: a reason is required and recorded", async () => {
    const { app, prisma } = await buildApp({ prisma: refundFixture() });
    for (const reason of [undefined, "", "   ", 5]) {
      const res = await resolve(app, "c1", { action: "decline", reason });
      assert.equal(res.statusCode, 400);
      assert.equal(res.json().code, "REASON_REQUIRED");
    }
    const res = await resolve(app, "c1", { action: "decline", reason: "Photo shows a full bowl" });
    assert.equal(res.statusCode, 200);
    const c = await prisma.supportCase.findUnique({ where: { id: "c1" } });
    assert.deepEqual([c.status, c.resolution, c.resolutionNote], ["DECLINED", "DECLINED", "Photo shows a full bowl"]);
  });

  test("unknown action is 400, unknown case 404, and a resolved case is never re-resolved", async () => {
    const { app, prisma } = await buildApp({ prisma: refundFixture() });
    assert.equal((await resolve(app, "c1", { action: "partial_refund", amountCents: 100 })).statusCode, 400);
    assert.equal((await resolve(app, "nope", { action: "decline", reason: "x" })).statusCode, 404);
    await resolve(app, "c1", { action: "decline", reason: "x" });
    const after = await resolve(app, "c1", { action: "credit", amountCents: 100 });
    assert.equal(after.json().alreadyResolved, true);
    assert.equal((await prisma.creditLot.findMany()).length, 0);
  });
});
