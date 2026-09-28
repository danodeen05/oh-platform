/**
 * Task B1: the /chappy/* route plugin, injected with fakes (no model calls).
 * Identity is server-verified: a member's Clerk session, or a SIGNED guest
 * token in x-chappy-guest. Raw guestId/sessionId values are never identity.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import twilio from "twilio";
import { FASTIFY_OPTIONS, rateLimitKey } from "../../http-config.js";
import { createCustomerAuth, registerCustomerIdentity } from "../../auth/customer.js";
import { registerChappyRoutes, GUEST_TOKEN_RATE_LIMIT } from "../routes.js";
import { fakeClient, fakePrisma, step, text } from "./fakes.js";

const ENV = { CLERK_SECRET_KEY: "sk_test_x", CHAPPY_GUEST_SECRET: "guest-secret-for-tests", ADMIN_API_KEY: "svc-key" };
const ALLOWED = "http://localhost:3100";
const SMS_ENV = Object.freeze({ TWILIO_AUTH_TOKEN: "twilio-test-auth-token", API_PUBLIC_URL: "https://api.example.com" });

function customerAuth() {
  return createCustomerAuth({
    env: ENV,
    verifyToken: async (token) => {
      if (token.startsWith("clerk:")) return { sub: token.slice(6) };
      throw new Error("bad signature");
    },
    getUser: async (id) => ({ primaryEmailAddressId: "e", emailAddresses: [{ id: "e", emailAddress: `${id}@x.com`, verification: { status: "verified" } }] }),
    prisma: { user: { findFirst: async ({ where }) => (where.email.equals === "me@x.com" ? { id: "db_me" } : null) } },
  });
}

async function build({ script = [step({ content: [text("Hi from Chappy")] })], checkLimits, prisma, withRateLimit = false, env = SMS_ENV, fastifyOptions = {} } = {}) {
  const app = Fastify(fastifyOptions);
  await app.register(cors, { origin: (origin, cb) => cb(null, !origin || origin === ALLOWED), credentials: true });
  await app.register(formbody);
  if (withRateLimit) await app.register(rateLimit, { max: 1000, timeWindow: "1 minute", keyGenerator: rateLimitKey });
  const auth = customerAuth();
  registerCustomerIdentity(app, auth);
  const client = fakeClient(script);
  const db = prisma || fakePrisma({ users: [{ id: "db_me", name: "Me", membershipTier: "CHOPSTICK", phone: "8015550100" }] });
  const executed = [];
  await registerChappyRoutes(app, {
    prisma: db,
    customerAuth: auth,
    client,
    tools: { defs: [], execute: async (n) => executed.push(n) },
    checkLimits,
    now: () => new Date("2026-10-01T18:00:00Z"),
    env,
  });
  await app.ready();
  return { app, client, db, auth };
}

const member = { authorization: "Bearer clerk:me" };
const chat = (app, headers, payload) => app.inject({ method: "POST", url: "/chappy/chat", headers: { "content-type": "application/json", ...headers }, payload });

function sseEvents(body) {
  return body
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("event:"))
    .map((chunk) => {
      const [ev, data] = chunk.split("\n");
      return { event: ev.slice(7), data: JSON.parse(data.slice(6)) };
    });
}

describe("POST /chappy/chat", () => {
  test("streams text/event-stream to a member and never sends a wildcard CORS header", async () => {
    const { app } = await build();
    const res = await chat(app, { ...member, origin: ALLOWED }, { message: "hello", locale: "en", channel: "web" });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /^text\/event-stream/);
    assert.notEqual(res.headers["access-control-allow-origin"], "*");
    assert.equal(res.headers["access-control-allow-origin"], ALLOWED);
    const events = sseEvents(res.body);
    assert.equal(events.filter((e) => e.event === "text").map((e) => e.data.delta).join(""), "Hi from Chappy");
    assert.equal(events.at(-1).event, "done");
  });

  test("a disallowed origin gets no CORS allow header at all", async () => {
    const { app } = await build();
    const res = await chat(app, { ...member, origin: "https://evil.example" }, { message: "hello" });
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });

  test("a message over 1,500 characters is 413 and reaches no model", async () => {
    const { app, client } = await build();
    const res = await chat(app, member, { message: "x".repeat(1501), locale: "en", channel: "web" });
    assert.equal(res.statusCode, 413);
    assert.equal(res.json().error, "MESSAGE_TOO_LONG");
    assert.equal(client.calls.length, 0);
    const ok = await chat(app, member, { message: "x".repeat(1500) });
    assert.equal(ok.statusCode, 200);
  });

  test("empty or non-string messages are 400", async () => {
    const { app } = await build();
    assert.equal((await chat(app, member, { message: "   " })).statusCode, 400);
    assert.equal((await chat(app, member, { message: 42 })).statusCode, 400);
  });

  test("an unsupported locale falls back to en in the context block", async () => {
    const { app, client } = await build();
    await chat(app, member, { message: "hola", locale: "fr" });
    const ctx = client.calls[0].params.messages.at(-1).content[0].text;
    assert.match(ctx, /"locale":"en"/);
  });

  test("checkLimits can refuse a turn before any model call (hook for B3)", async () => {
    const seen = [];
    const { app, client } = await build({
      checkLimits: async (args) => {
        seen.push(args);
        return { status: 429, code: "CHAPPY_LIMIT" };
      },
    });
    const res = await chat(app, member, { message: "hello" });
    assert.equal(res.statusCode, 429);
    assert.equal(res.json().error, "CHAPPY_LIMIT");
    assert.equal(client.calls.length, 0);
    assert.equal(seen[0].identity.kind, "member");
    assert.equal(seen[0].channel, "web");
  });
});

describe("identity preHandler (one check for every Chappy route)", () => {
  test("no credentials: 401 on chat, history and reset", async () => {
    const { app } = await build();
    assert.equal((await chat(app, {}, { message: "hi" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/chappy/history" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/chappy/reset", payload: {} })).statusCode, 401);
  });

  test("raw guestId / sessionId / userId are never identity", async () => {
    const { app, client } = await build();
    for (const payload of [{ message: "hi", guestId: "guest_1" }, { message: "hi", sessionId: "chappy-1-abc" }, { message: "hi", userId: "db_me" }]) {
      assert.equal((await chat(app, {}, payload)).statusCode, 401, JSON.stringify(payload));
    }
    assert.equal((await app.inject({ method: "GET", url: "/chappy/history?guestId=guest_1" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/chappy/history?sessionId=abc" })).statusCode, 401);
    assert.equal(client.calls.length, 0);
  });

  test("a forged or tampered guest token is 401", async () => {
    const { app, auth } = await build();
    const token = auth.issueGuestToken();
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "BB" : "AA");
    assert.equal((await chat(app, { "x-chappy-guest": tampered }, { message: "hi" })).statusCode, 401);
    assert.equal((await chat(app, { "x-chappy-guest": "g1.fake.sig" }, { message: "hi" })).statusCode, 401);
  });

  test("a signed guest token from POST /chappy/guest-token works, and two guests never share a conversation", async () => {
    const { app, db } = await build();
    const t1 = (await app.inject({ method: "POST", url: "/chappy/guest-token" })).json().token;
    const t2 = (await app.inject({ method: "POST", url: "/chappy/guest-token" })).json().token;
    assert.match(t1, /^g1\./);
    assert.notEqual(t1, t2);
    assert.equal((await chat(app, { "x-chappy-guest": t1 }, { message: "one" })).statusCode, 200);
    assert.equal((await chat(app, { "x-chappy-guest": t2 }, { message: "two" })).statusCode, 200);
    const ids = new Set(db.convs.map((c) => c.identifier));
    assert.equal(ids.size, 2);
    for (const id of ids) assert.match(id, /^guest:/);
  });

  test("a member is keyed by the verified database id; a body userId is ignored", async () => {
    const { app, db } = await build();
    await chat(app, member, { message: "hi", userId: "db_other" });
    assert.deepEqual(db.convs.map((c) => c.identifier), ["db_me"]);
  });

  test("history shows only the customer's words and Chappy's text", async () => {
    const { app } = await build({
      script: [
        step({ content: [text("Looking."), { type: "tool_use", id: "t1", name: "missing_tool", input: {} }], stop_reason: "tool_use" }),
        step({ content: [text("Done.")] }),
      ],
    });
    await chat(app, member, { message: "menu please" });
    const h = (await app.inject({ method: "GET", url: "/chappy/history", headers: member })).json();
    assert.equal(h.isNew, false);
    assert.deepEqual(h.messages.map((m) => [m.role, m.content]), [["user", "menu please"], ["assistant", "Looking."], ["assistant", "Done."]]);
  });

  test("reset clears the caller's own web conversation only", async () => {
    const { app, db } = await build();
    await chat(app, member, { message: "hi" });
    const res = await app.inject({ method: "POST", url: "/chappy/reset", headers: member, payload: { channel: "sms" } });
    assert.equal(res.statusCode, 200);
    assert.equal(db.convs.find((c) => c.identifier === "db_me").isActive, false);
  });
});

describe("POST /chappy/guest-token", () => {
  test("issues a verifiable token and is rate limited", async () => {
    const { app, auth } = await build({ withRateLimit: true });
    const first = await app.inject({ method: "POST", url: "/chappy/guest-token" });
    assert.equal(first.statusCode, 200);
    assert.equal(auth.verifyGuestToken(first.json().token)?.kind, "guest");
    let last;
    for (let i = 1; i <= GUEST_TOKEN_RATE_LIMIT.max; i++) last = await app.inject({ method: "POST", url: "/chappy/guest-token" });
    assert.equal(last.statusCode, 429);
  });

  test("behind the proxy (index.js server options), each real client IP gets its own bucket", async () => {
    assert.equal(FASTIFY_OPTIONS.trustProxy, 1);
    const { app } = await build({ withRateLimit: true, fastifyOptions: { ...FASTIFY_OPTIONS, logger: false } });
    // Railway appends the address it saw: "<whatever the client sent>, <real ip>".
    const from = (xff) => app.inject({ method: "POST", url: "/chappy/guest-token", headers: { "x-forwarded-for": xff } });
    for (let i = 0; i < GUEST_TOKEN_RATE_LIMIT.max; i++) assert.equal((await from("203.0.113.10")).statusCode, 200);
    assert.equal((await from("203.0.113.10")).statusCode, 429, "client A is out");
    assert.equal((await from("198.51.100.20")).statusCode, 200, "client B has its own bucket");
    // A client cannot pick a fresh bucket by forging the leftmost entry.
    assert.equal((await from("1.2.3.4, 203.0.113.10")).statusCode, 429);
    assert.equal((await from("5.6.7.8, 203.0.113.10")).statusCode, 429);
  });

  test("without trustProxy every client shares the proxy's bucket (the bug this fixes)", async () => {
    const { app } = await build({ withRateLimit: true });
    const from = (xff) => app.inject({ method: "POST", url: "/chappy/guest-token", headers: { "x-forwarded-for": xff } });
    for (let i = 0; i < GUEST_TOKEN_RATE_LIMIT.max; i++) await from("203.0.113.10");
    assert.equal((await from("198.51.100.20")).statusCode, 429);
  });
});

describe("POST /chappy/sms (Twilio webhook)", () => {
  const URL_SMS = `${SMS_ENV.API_PUBLIC_URL}/chappy/sms`;
  const sign = (params, url = URL_SMS, token = SMS_ENV.TWILIO_AUTH_TOKEN) => twilio.getExpectedTwilioSignature(token, url, params);
  const sms = (app, params, headers = {}) =>
    app.inject({ method: "POST", url: "/chappy/sms", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, payload: new URLSearchParams(params).toString() });
  const signed = (app, params) => sms(app, params, { "x-twilio-signature": sign(params) });
  const HUNGRY = { From: "+18015550100", Body: "hungry", To: "+18015550000", MessageSid: "SM1" };

  test("a valid Twilio signature passes: same agent, TwiML reply", async () => {
    const { app, client } = await build({ script: [step({ content: [text("Bowl time. Come in.")] })] });
    const res = await signed(app, HUNGRY);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/xml/);
    assert.match(res.body, /<Response><Message>Bowl time\. Come in\.<\/Message><\/Response>/);
    assert.equal(client.calls.length, 1);
    assert.match(client.calls[0].params.messages.at(-1).content[0].text, /"channel":"sms"/);
  });

  test("missing, wrong or wrong-URL signatures are 403 before any agent or database work", async () => {
    const { app, client, db } = await build();
    let dbTouched = 0;
    const origUpdate = db.user.updateMany;
    db.user.updateMany = async (...a) => (dbTouched++, origUpdate(...a));
    const STOP = { From: "+18015550100", Body: "STOP" };
    assert.equal((await sms(app, HUNGRY)).statusCode, 403, "missing");
    assert.equal((await sms(app, STOP)).statusCode, 403, "missing, keyword");
    assert.equal((await sms(app, HUNGRY, { "x-twilio-signature": "bm90LWEtc2ln" })).statusCode, 403, "wrong");
    assert.equal((await sms(app, HUNGRY, { "x-twilio-signature": sign(HUNGRY, "https://evil.example/chappy/sms") })).statusCode, 403, "other URL");
    assert.equal((await sms(app, HUNGRY, { "x-twilio-signature": sign(HUNGRY, URL_SMS, "other-token") })).statusCode, 403, "other token");
    assert.equal((await sms(app, { ...HUNGRY, Body: "tampered" }, { "x-twilio-signature": sign(HUNGRY) })).statusCode, 403, "tampered params");
    assert.equal(client.calls.length, 0);
    assert.equal(dbTouched, 0);
  });

  test("no TWILIO_AUTH_TOKEN is 403, even in development", async () => {
    const { app, client } = await build({ env: { NODE_ENV: "development", API_PUBLIC_URL: SMS_ENV.API_PUBLIC_URL } });
    assert.equal((await signed(app, HUNGRY)).statusCode, 403);
    assert.equal(client.calls.length, 0);
  });

  test("CHAPPY_SMS_SKIP_SIGNATURE=1 works locally and is ignored in production", async () => {
    const dev = await build({ env: { NODE_ENV: "development", CHAPPY_SMS_SKIP_SIGNATURE: "1" } });
    assert.equal((await sms(dev.app, HUNGRY)).statusCode, 200);
    const prod = await build({ env: { NODE_ENV: "production", CHAPPY_SMS_SKIP_SIGNATURE: "1", TWILIO_AUTH_TOKEN: "t" } });
    assert.equal((await sms(prod.app, HUNGRY)).statusCode, 403);
    assert.equal(prod.client.calls.length, 0);
  });

  test("without API_PUBLIC_URL the URL comes from x-forwarded-proto / host (Railway proxy)", async () => {
    const env = { TWILIO_AUTH_TOKEN: SMS_ENV.TWILIO_AUTH_TOKEN };
    const { app } = await build({ env });
    const sig = sign(HUNGRY, "https://api.ohbeef.com/chappy/sms");
    const ok = await sms(app, HUNGRY, { "x-twilio-signature": sig, "x-forwarded-proto": "https", host: "api.ohbeef.com" });
    assert.equal(ok.statusCode, 200);
    const bad = await sms(app, HUNGRY, { "x-twilio-signature": sig, "x-forwarded-proto": "http", host: "api.ohbeef.com" });
    assert.equal(bad.statusCode, 403);
  });

  test("STOP is handled without the model", async () => {
    const { app, client } = await build();
    const res = await signed(app, { From: "+18015550100", Body: "STOP" });
    assert.match(res.body, /unsubscribed/);
    assert.equal(client.calls.length, 0);
  });

  test("an over-long SMS gets a short reply, not a model call", async () => {
    const { app, client } = await build();
    const res = await signed(app, { From: "+18015550100", Body: "x".repeat(1501) });
    assert.equal(res.statusCode, 200);
    assert.equal(client.calls.length, 0);
    assert.match(res.body, /<Message>/);
  });
});

describe("payments (Task B2)", () => {
  test("POST /chappy/confirm-payment is gone: payment is confirmed only by the order routes", async () => {
    const { app } = await build();
    const res = await app.inject({ method: "POST", url: "/chappy/confirm-payment", headers: { ...member, "content-type": "application/json" }, payload: { orderId: "o1", paymentIntentId: "pi_1" } });
    assert.equal(res.statusCode, 404);
  });
});
