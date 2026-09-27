import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import { createCustomerAuth, registerCustomerIdentity, GUEST_TOKEN_TTL_MS, orderOwnerId, chappyCreditsToDeduct, resolveChappyWebIdentity } from "../customer.js";

const ENV = { CLERK_SECRET_KEY: "sk_test_x", CLERK_SECRET_KEY_DEV: "sk_dev_y", CHAPPY_GUEST_SECRET: "guest-secret-for-tests", ADMIN_API_KEY: "key-123" };

const CLERK_USERS = {
  user_me: { primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "Me@X.com", verification: { status: "verified" } }] },
  user_other: { primaryEmailAddressId: "e2", emailAddresses: [{ id: "e2", emailAddress: "other@x.com", verification: { status: "verified" } }] },
  user_new: { primaryEmailAddressId: "e3", emailAddresses: [{ id: "e3", emailAddress: "new@x.com", verification: { status: "verified" } }] },
  user_unverified: { primaryEmailAddressId: "e4", emailAddresses: [{ id: "e4", emailAddress: "me@x.com", verification: { status: "unverified" } }] },
  user_noverification: { primaryEmailAddressId: "e5", emailAddresses: [{ id: "e5", emailAddress: "me@x.com" }] },
};
const DB_USERS = { "me@x.com": "db_me", "other@x.com": "db_other" };

function build({ env = ENV, clock } = {}) {
  const calls = { verify: 0, getUser: 0, findUser: 0 };
  let t = clock ?? 1_800_000_000_000;
  const auth = createCustomerAuth({
    env,
    now: () => t,
    verifyToken: async (token, secretKey) => {
      calls.verify += 1;
      if (secretKey === "sk_test_x" && token.startsWith("clerk:")) return { sub: token.slice(6) };
      if (secretKey === "sk_dev_y" && token.startsWith("devclerk:")) return { sub: token.slice(9) };
      throw new Error("bad signature");
    },
    getUser: async (id) => {
      calls.getUser += 1;
      if (!CLERK_USERS[id]) throw new Error("no such user");
      return CLERK_USERS[id];
    },
    prisma: {
      user: {
        findFirst: async ({ where }) => {
          calls.findUser += 1;
          const email = (where.email?.equals ?? where.email ?? "").toLowerCase();
          return DB_USERS[email] ? { id: DB_USERS[email] } : null;
        },
      },
    },
  });
  return { auth, calls, advance: (ms) => { t += ms; } };
}

const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });

function replyStub() {
  const r = { statusCode: 200, body: null, sent: false };
  r.code = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.body = b; r.sent = true; return r; };
  return r;
}

describe("resolve", () => {
  test("no credentials and a forged bearer are anonymous", async () => {
    const { auth } = build();
    assert.deepEqual(await auth.resolve({ headers: {} }), { kind: "anonymous" });
    assert.deepEqual(await auth.resolve(bearer("forged-token")), { kind: "anonymous" });
    assert.deepEqual(await auth.resolve({ headers: { authorization: "Basic abc" } }), { kind: "anonymous" });
  });

  test("a verified Clerk token maps to the database user by primary email, cached", async () => {
    const { auth, calls } = build();
    for (let i = 0; i < 3; i += 1) {
      assert.deepEqual(await auth.resolve(bearer("clerk:user_me")), { kind: "user", userId: "db_me", email: "me@x.com" });
    }
    assert.equal(calls.getUser, 1, "Clerk user lookup is cached");
    assert.equal(calls.findUser, 1, "email to user id lookup is cached");
  });

  test("the development Clerk instance is accepted too", async () => {
    const { auth } = build();
    assert.deepEqual(await auth.resolve(bearer("devclerk:user_other")), { kind: "user", userId: "db_other", email: "other@x.com" });
  });

  test("a signed-in person with no database row yet has a null userId, and it is not cached", async () => {
    const { auth, calls } = build();
    assert.deepEqual(await auth.resolve(bearer("clerk:user_new")), { kind: "user", userId: null, email: "new@x.com" });
    await auth.resolve(bearer("clerk:user_new"));
    assert.equal(calls.findUser, 2);
  });

  test("an unverified primary email is not trusted", async () => {
    const { auth } = build();
    assert.deepEqual(await auth.resolve(bearer("clerk:user_unverified")), { kind: "anonymous" });
  });

  test("a primary email without a verification status is not trusted", async () => {
    const { auth } = build();
    assert.deepEqual(await auth.resolve(bearer("clerk:user_noverification")), { kind: "anonymous" });
  });

  test("in production a token verified by the development key is rejected", async () => {
    const { auth, calls } = build({ env: { ...ENV, NODE_ENV: "production" } });
    assert.deepEqual(await auth.resolve(bearer("devclerk:user_other")), { kind: "anonymous" });
    assert.equal(calls.verify, 1, "only the production key was tried");
    assert.equal((await auth.resolve(bearer("clerk:user_me"))).userId, "db_me");
    assert.ok(auth.warnings.some((w) => w.includes("CLERK_SECRET_KEY_DEV")));
  });

  test("production without CHAPPY_GUEST_SECRET announces a startup warning", () => {
    const { auth } = build({ env: { CLERK_SECRET_KEY: "sk_test_x", NODE_ENV: "production" } });
    assert.ok(auth.warnings.some((w) => w.includes("CHAPPY_GUEST_SECRET")));
    assert.deepEqual(build().auth.warnings, []);
  });

  test("resolution is memoised per request", async () => {
    const { auth, calls } = build();
    const req = bearer("clerk:user_me");
    await auth.resolve(req);
    await auth.resolve(req);
    assert.equal(calls.verify, 1);
    assert.equal(req.customer.userId, "db_me");
  });
});

describe("guest tokens", () => {
  test("format is g1.<random>.<hmac> and resolves to a guest", async () => {
    const { auth } = build();
    const token = auth.issueGuestToken();
    const parts = token.split(".");
    assert.equal(parts.length, 3);
    assert.equal(parts[0], "g1");
    const who = await auth.resolve(bearer(token));
    assert.equal(who.kind, "guest");
    assert.equal(who.guestKey, parts[1]);
    const viaHeader = await auth.resolve({ headers: { "x-guest-token": token } });
    assert.equal(viaHeader.kind, "guest");
  });

  test("a tampered guest token resolves to anonymous", async () => {
    const { auth } = build();
    const [v, random, mac] = auth.issueGuestToken().split(".");
    const flipped = mac[0] === "A" ? `B${mac.slice(1)}` : `A${mac.slice(1)}`;
    assert.deepEqual(await auth.resolve(bearer(`${v}.${random}.${flipped}`)), { kind: "anonymous" });
    assert.deepEqual(await auth.resolve(bearer(`${v}.${random}x.${mac}`)), { kind: "anonymous" });
    assert.deepEqual(await auth.resolve(bearer(`g2.${random}.${mac}`)), { kind: "anonymous" });
    const otherSecret = crypto.createHmac("sha256", "wrong").update(`g1.${random}`).digest("base64url");
    assert.deepEqual(await auth.resolve(bearer(`g1.${random}.${otherSecret}`)), { kind: "anonymous" });
  });

  test("a guest token expires after 30 days", async () => {
    const { auth, advance } = build();
    const token = auth.issueGuestToken();
    advance(GUEST_TOKEN_TTL_MS - 1000);
    assert.equal((await auth.resolve(bearer(token))).kind, "guest");
    advance(2000);
    assert.deepEqual(await auth.resolve(bearer(token)), { kind: "anonymous" });
  });

  test("issuing without CHAPPY_GUEST_SECRET throws and nothing verifies", async () => {
    const { auth } = build({ env: { CLERK_SECRET_KEY: "sk_test_x" } });
    assert.throws(() => auth.issueGuestToken());
    const signed = build().auth.issueGuestToken();
    assert.deepEqual(await auth.resolve(bearer(signed)), { kind: "anonymous" });
  });
});

describe("requireUser / requireSelf / requireEmail", () => {
  test("requireUser: 401 anonymous, 403 when there is no account yet, identity otherwise", async () => {
    const { auth } = build();
    let reply = replyStub();
    assert.equal(await auth.requireUser({ headers: {} }, reply), null);
    assert.equal(reply.statusCode, 401);
    reply = replyStub();
    assert.equal(await auth.requireUser(bearer("clerk:user_new"), reply), null);
    assert.equal(reply.statusCode, 403);
    reply = replyStub();
    assert.equal((await auth.requireUser(bearer("clerk:user_me"), reply)).userId, "db_me");
    assert.equal(reply.sent, false);
  });

  test("requireSelf: guests are 401, other users are 403, the API key passes", async () => {
    const { auth } = build();
    let reply = replyStub();
    assert.equal(await auth.requireSelf({ headers: { "x-guest-token": auth.issueGuestToken() } }, reply, "db_me"), null);
    assert.equal(reply.statusCode, 401);
    reply = replyStub();
    assert.equal(await auth.requireSelf(bearer("clerk:user_me"), reply, "db_other"), null);
    assert.equal(reply.statusCode, 403);
    reply = replyStub();
    assert.equal((await auth.requireSelf({ headers: { "x-admin-api-key": "key-123" } }, reply, "db_other")).kind, "service");
    reply = replyStub();
    assert.equal(await auth.requireSelf({ headers: { "x-admin-api-key": "nope" } }, reply, "db_other"), null);
    assert.equal(reply.statusCode, 401);
  });

  test("requireEmail compares case-insensitively", async () => {
    const { auth } = build();
    let reply = replyStub();
    assert.ok(await auth.requireEmail(bearer("clerk:user_me"), reply, "ME@x.com"));
    reply = replyStub();
    assert.equal(await auth.requireEmail(bearer("clerk:user_me"), reply, "other@x.com"), null);
    assert.equal(reply.statusCode, 403);
  });
});

describe("signed links", () => {
  test("valid for the subject and purpose until expiry", () => {
    const { auth, advance } = build();
    const { exp, sig } = auth.signLink("wallet", "db_me", 60_000);
    assert.equal(auth.verifyLink("wallet", "db_me", exp, sig), true);
    assert.equal(auth.verifyLink("wallet", "db_other", exp, sig), false);
    assert.equal(auth.verifyLink("chappy-stream", "db_me", exp, sig), false);
    assert.equal(auth.verifyLink("wallet", "db_me", String(Number(exp) + 1), sig), false);
    advance(61_000);
    assert.equal(auth.verifyLink("wallet", "db_me", exp, sig), false);
  });
});

describe("registerCustomerIdentity on a Fastify app", () => {
  async function appWith() {
    const { auth } = build();
    const app = Fastify();
    registerCustomerIdentity(app, auth);
    // Mirrors how index.js routes read identity: never from the body.
    app.post("/chappy/chat", async (req) => ({ userId: req.customer.kind === "user" ? req.customer.userId : null, bodyUserId: req.body.userId }));
    app.get("/users/:id/profile", async (req) => ({ id: req.params.id }));
    app.post("/users/:userId/challenges/:challengeId/claim", async (req) => ({ ok: req.params.userId }));
    app.get("/users/:id/wallet/apple", async () => ({ pass: true }));
    app.get("/users/by-email/:email", async (req, reply) => {
      if (!(await auth.requireEmail(req, reply, req.params.email))) return reply;
      return { email: req.params.email };
    });
    app.get("/users/referral/:code", async () => ({ public: true }));
    await app.ready();
    return { app, auth };
  }

  test("a forged userId in the body is ignored: the route sees the verified id", async () => {
    const { app } = await appWith();
    const res = await app.inject({ method: "POST", url: "/chappy/chat", headers: { authorization: "Bearer clerk:user_me" }, payload: { userId: "db_other", message: "hi" } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { userId: "db_me", bodyUserId: "db_other" });
    const anon = await app.inject({ method: "POST", url: "/chappy/chat", payload: { userId: "db_other" } });
    assert.equal(anon.json().userId, null);
  });

  test("requireSelf returns 403 for another user's /users/:id/profile", async () => {
    const { app } = await appWith();
    const other = await app.inject({ method: "GET", url: "/users/db_other/profile", headers: { authorization: "Bearer clerk:user_me" } });
    assert.equal(other.statusCode, 403);
    const mine = await app.inject({ method: "GET", url: "/users/db_me/profile", headers: { authorization: "Bearer clerk:user_me" } });
    assert.equal(mine.statusCode, 200);
    const none = await app.inject({ method: "GET", url: "/users/db_me/profile" });
    assert.equal(none.statusCode, 401);
    const claim = await app.inject({ method: "POST", url: "/users/db_other/challenges/c1/claim", headers: { authorization: "Bearer clerk:user_me" } });
    assert.equal(claim.statusCode, 403);
    const service = await app.inject({ method: "GET", url: "/users/db_other/profile", headers: { "x-admin-api-key": "key-123" } });
    assert.equal(service.statusCode, 200);
  });

  test("wallet pass downloads accept a short-lived signed link instead of a header", async () => {
    const { app, auth } = await appWith();
    const { exp, sig } = auth.signLink("wallet", "db_me");
    const ok = await app.inject({ method: "GET", url: `/users/db_me/wallet/apple?exp=${exp}&sig=${sig}` });
    assert.equal(ok.statusCode, 200);
    const wrongUser = await app.inject({ method: "GET", url: `/users/db_other/wallet/apple?exp=${exp}&sig=${sig}` });
    assert.equal(wrongUser.statusCode, 401);
  });

  test("/users/by-email/other@x.com returns 403 for a caller who is me@x.com", async () => {
    const { app } = await appWith();
    const other = await app.inject({ method: "GET", url: "/users/by-email/other%40x.com", headers: { authorization: "Bearer clerk:user_me" } });
    assert.equal(other.statusCode, 403);
    const mine = await app.inject({ method: "GET", url: "/users/by-email/me%40x.com", headers: { authorization: "Bearer clerk:user_me" } });
    assert.equal(mine.statusCode, 200);
    const anon = await app.inject({ method: "GET", url: "/users/by-email/me%40x.com" });
    assert.equal(anon.statusCode, 401);
  });

  test("routes outside /users/:id are not guarded", async () => {
    const { app } = await appWith();
    const res = await app.inject({ method: "GET", url: "/users/referral/abc" });
    assert.equal(res.statusCode, 200);
  });
});

describe("POST /users gate (signupFields, used by the real handler)", () => {
  test("anonymous 401, another email 403, own email passes and a client phone is dropped", async () => {
    const { auth } = build();
    let reply = replyStub();
    assert.equal(await auth.signupFields({ headers: {}, body: { email: "me@x.com" } }, reply), null);
    assert.equal(reply.statusCode, 401);
    reply = replyStub();
    assert.equal(await auth.signupFields({ ...bearer("clerk:user_me"), body: { email: "other@x.com" } }, reply), null);
    assert.equal(reply.statusCode, 403);
    reply = replyStub();
    assert.equal(await auth.signupFields({ ...bearer("clerk:user_me"), body: { phone: "+18015550100" } }, reply), null);
    assert.equal(reply.statusCode, 403);
    reply = replyStub();
    assert.deepEqual(await auth.signupFields({ ...bearer("clerk:user_me"), body: { email: " ME@x.com ", phone: "+18015550100" } }, reply), { email: "ME@x.com", phone: undefined });
    assert.equal(reply.sent, false);
  });
  test("a new Clerk user without a row can sign up; a trusted service keeps email and phone", async () => {
    const { auth } = build();
    assert.deepEqual(await auth.signupFields({ ...bearer("clerk:user_new"), body: { email: "new@x.com" } }, replyStub()), { email: "new@x.com", phone: undefined });
    assert.deepEqual(await auth.signupFields({ headers: { "x-admin-api-key": "key-123" }, body: { phone: "+18015550100" } }, replyStub()), { email: undefined, phone: "+18015550100" });
  });
});

describe("order ownership and Chappy credits", () => {
  test("orderOwnerId: only a verified member with a row owns an order", () => {
    assert.equal(orderOwnerId({ kind: "user", userId: "db_me", email: "me@x.com" }), "db_me");
    assert.equal(orderOwnerId({ kind: "user", userId: null, email: "new@x.com" }), null);
    assert.equal(orderOwnerId({ kind: "guest", guestKey: "k" }), null);
    assert.equal(orderOwnerId({ kind: "anonymous" }), null);
    assert.equal(orderOwnerId({ kind: "service" }), null);
  });
  test("chappyCreditsToDeduct: only the verified caller's own order, capped at $5", () => {
    const me = { kind: "user", userId: "db_me", email: "me@x.com" };
    assert.equal(chappyCreditsToDeduct(me, { userId: "db_me", user: { creditsCents: 1200 } }), 500);
    assert.equal(chappyCreditsToDeduct(me, { userId: "db_me", user: { creditsCents: 300 } }), 300);
    assert.equal(chappyCreditsToDeduct(me, { userId: "db_victim", user: { creditsCents: 1200 } }), 0);
    assert.equal(chappyCreditsToDeduct({ kind: "anonymous" }, { userId: "db_victim", user: { creditsCents: 1200 } }), 0);
    assert.equal(chappyCreditsToDeduct(me, { userId: "db_me", user: { creditsCents: 0 } }), 0);
  });
});

describe("resolveChappyWebIdentity", () => {
  const isMemberId = async (id) => id === "db_me" || id === "db_other";
  test("a member comes from the ticket or the session", async () => {
    assert.deepEqual(await resolveChappyWebIdentity({ who: { kind: "anonymous" }, ticketUserId: "db_me", sessionId: "s1", isMemberId }), { userId: "db_me", guestId: null, identifier: "db_me" });
    assert.deepEqual(await resolveChappyWebIdentity({ who: { kind: "user", userId: "db_me", email: "me@x.com" }, guestId: "g1", isMemberId }), { userId: "db_me", guestId: null, identifier: "db_me" });
  });
  test("unidentified requests get no identifier: no shared fallback, no reserved key, no member id", async () => {
    const anon = { kind: "anonymous" };
    for (const input of [{}, { sessionId: "anonymous" }, { sessionId: "ANONYMOUS" }, { guestId: "db_other" }, { sessionId: "db_me" }, { guestId: "", sessionId: "" }]) {
      assert.deepEqual(await resolveChappyWebIdentity({ who: anon, isMemberId, ...input }), { userId: null, guestId: null, identifier: null }, JSON.stringify(input));
    }
  });
  test("guests keep their own guest or session id", async () => {
    assert.deepEqual(await resolveChappyWebIdentity({ who: { kind: "anonymous" }, guestId: "guest_1", isMemberId }), { userId: null, guestId: "guest_1", identifier: "guest_1" });
    assert.deepEqual(await resolveChappyWebIdentity({ who: { kind: "anonymous" }, sessionId: "chappy-1-abc", isMemberId }), { userId: null, guestId: null, identifier: "chappy-1-abc" });
  });
});

describe("integration: identity wiring as index.js uses it (Fastify inject)", () => {
  // These routes call the same exported decision functions the real handlers
  // call, with registerCustomerIdentity installed exactly as in index.js.
  async function app() {
    const { auth } = build();
    const f = Fastify();
    registerCustomerIdentity(f, auth);
    f.post("/users", async (req, reply) => {
      const allowed = await auth.signupFields(req, reply);
      if (!allowed) return reply;
      return allowed;
    });
    f.post("/orders", async (req) => {
      const { guestId } = req.body || {};
      return { userId: orderOwnerId(await auth.resolve(req)), guestId: guestId || null };
    });
    f.post("/chappy/stream-ticket", async (req, reply) => {
      const who = await auth.requireUser(req, reply);
      if (!who) return reply;
      return { uid: who.userId, ...auth.signLink("chappy-stream", who.userId, 120000) };
    });
    f.get("/chappy/chat/stream", async (req, reply) => {
      const { uid, exp, sig } = req.query;
      const ticketUserId = uid && auth.verifyLink("chappy-stream", uid, exp, sig) ? uid : null;
      const id = await resolveChappyWebIdentity({ who: await auth.resolve(req), ticketUserId, ...req.query, isMemberId: async (x) => x.startsWith("db_") });
      if (!id.identifier) return reply.status(401).send({ error: "unidentified" });
      return id;
    });
    await f.ready();
    return f;
  }

  test("POST /users: the email must match the verified email", async () => {
    const f = await app();
    assert.equal((await f.inject({ method: "POST", url: "/users", payload: { email: "me@x.com" } })).statusCode, 401);
    assert.equal((await f.inject({ method: "POST", url: "/users", headers: { authorization: "Bearer clerk:user_me" }, payload: { email: "other@x.com" } })).statusCode, 403);
    assert.equal((await f.inject({ method: "POST", url: "/users", headers: { authorization: "Bearer clerk:user_me" }, payload: { email: "me@x.com" } })).statusCode, 200);
  });

  test("POST /orders: a forged userId is ignored; anonymous and guests get null", async () => {
    const f = await app();
    const member = await f.inject({ method: "POST", url: "/orders", headers: { authorization: "Bearer clerk:user_me" }, payload: { userId: "db_other" } });
    assert.equal(member.json().userId, "db_me");
    const anon = await f.inject({ method: "POST", url: "/orders", payload: { userId: "db_other", guestId: "guest_1" } });
    assert.deepEqual(anon.json(), { userId: null, guestId: "guest_1" });
  });

  test("Chappy stream: a member ticket works; a missing or invalid ticket gives no stream and no shared identity", async () => {
    const f = await app();
    const ticket = (await f.inject({ method: "POST", url: "/chappy/stream-ticket", headers: { authorization: "Bearer clerk:user_me" } })).json();
    const ok = await f.inject({ method: "GET", url: `/chappy/chat/stream?message=hi&uid=${ticket.uid}&exp=${ticket.exp}&sig=${encodeURIComponent(ticket.sig)}` });
    assert.equal(ok.json().identifier, "db_me");
    const forgedUid = await f.inject({ method: "GET", url: `/chappy/chat/stream?message=hi&uid=db_other&exp=${ticket.exp}&sig=${encodeURIComponent(ticket.sig)}` });
    assert.equal(forgedUid.statusCode, 401);
    assert.equal((await f.inject({ method: "GET", url: "/chappy/chat/stream?message=hi" })).statusCode, 401);
    assert.equal((await f.inject({ method: "GET", url: "/chappy/chat/stream?message=hi&userId=db_me" })).statusCode, 401);
    assert.equal((await f.inject({ method: "GET", url: "/chappy/chat/stream?message=hi&sessionId=anonymous" })).statusCode, 401);
    assert.equal((await f.inject({ method: "POST", url: "/chappy/stream-ticket" })).statusCode, 401);
  });
});
