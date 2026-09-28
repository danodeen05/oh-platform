import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { createCustomerAuth, registerCustomerIdentity } from "../../auth/customer.js";
import { makeMemoryPrisma } from "../../__tests__/helpers/prisma-memory.js";
import { registerMembershipRoutes } from "../routes.js";
import { PROGRAM } from "../program.js";

const ENV = { CLERK_SECRET_KEY: "sk_test_x", ADMIN_API_KEY: "key-123" };

const CLERK_USERS = {
  user_me: { primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "me@x.com", verification: { status: "verified" } }] },
  user_other: { primaryEmailAddressId: "e2", emailAddresses: [{ id: "e2", emailAddress: "other@x.com", verification: { status: "verified" } }] },
};

async function buildApp() {
  const prisma = makeMemoryPrisma({
    users: [
      { id: "db_me", email: "me@x.com" },
      { id: "db_other", email: "other@x.com" },
    ],
    rewards: [
      { id: "r1", userId: "db_me", type: "FREE_BOWL", issuedFor: "upgrade:NOODLE_MASTER", windowEndsAt: new Date(Date.now() + 86400000) },
      { id: "r2", userId: "db_me", type: "FREE_BOWL", issuedFor: "upgrade:CHOPSTICK", windowEndsAt: new Date(Date.now() - 86400000) },
    ],
  });

  const customerAuth = createCustomerAuth({
    env: ENV,
    verifyToken: async (token) => {
      if (token.startsWith("clerk:")) return { sub: token.slice(6) };
      throw new Error("bad signature");
    },
    getUser: async (id) => {
      if (!CLERK_USERS[id]) throw new Error("no such user");
      return CLERK_USERS[id];
    },
    prisma: {
      user: {
        findFirst: async ({ where }) => {
          const email = (where.email?.equals ?? "").toLowerCase();
          const row = await prisma.user.findFirst({ where: { email } });
          return row ? { id: row.id } : null;
        },
      },
    },
  });

  const app = Fastify({ logger: false });
  registerCustomerIdentity(app, customerAuth);
  await registerMembershipRoutes(app, { prisma });
  await app.ready();
  return { app, prisma };
}

describe("GET /membership/program", () => {
  test("is public and matches publicProgram()", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "GET", url: "/membership/program" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.timezone, PROGRAM.timezone);
    assert.equal(body.referral.referrerCents, PROGRAM.referral.referrerCents);
    assert.equal(body.goodwill, undefined, "goodwill config is not public");
  });
});

describe("GET /users/:id/rewards", () => {
  test("401s an unauthenticated caller", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "GET", url: "/users/db_me/rewards" });
    assert.equal(res.statusCode, 401);
  });

  test("403s a signed-in caller reading someone else's rewards", async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/users/db_me/rewards",
      headers: { authorization: "Bearer clerk:user_other" },
    });
    assert.equal(res.statusCode, 403);
  });

  test("returns the caller's own rewards, flagged active or not", async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/users/db_me/rewards",
      headers: { authorization: "Bearer clerk:user_me" },
    });
    assert.equal(res.statusCode, 200);
    const { rewards } = res.json();
    assert.equal(rewards.length, 2);
    const active = rewards.find((r) => r.id === "r1");
    const expired = rewards.find((r) => r.id === "r2");
    assert.equal(active.active, true);
    assert.equal(expired.active, false);
  });

  test("a trusted service call (x-admin-api-key) may read any user's rewards", async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/users/db_me/rewards",
      headers: { "x-admin-api-key": "key-123" },
    });
    assert.equal(res.statusCode, 200);
  });
});

describe("POST /users/:id/moments (Task D8)", () => {
  const post = (app, id, payload, headers = { authorization: "Bearer clerk:user_me" }) =>
    app.inject({ method: "POST", url: `/users/${id}/moments`, headers, payload });

  test("401s an unauthenticated caller", async () => {
    const { app } = await buildApp();
    const res = await post(app, "db_me", { welcomeSeen: true }, {});
    assert.equal(res.statusCode, 401);
  });

  test("403s a signed-in caller writing someone else's moments", async () => {
    const { app, prisma } = await buildApp();
    const res = await post(app, "db_me", { welcomeSeen: true }, { authorization: "Bearer clerk:user_other" });
    assert.equal(res.statusCode, 403);
    const me = await prisma.user.findUnique({ where: { id: "db_me" } });
    assert.equal(me.welcomeSeenAt ?? null, null, "nothing written");
  });

  test("welcomeSeen sets welcomeSeenAt once; a repeat keeps the first time (idempotent)", async () => {
    const { app, prisma } = await buildApp();
    const first = await post(app, "db_me", { welcomeSeen: true });
    assert.equal(first.statusCode, 200);
    const seenAt = first.json().welcomeSeenAt;
    assert.ok(seenAt, "welcomeSeenAt returned");
    await new Promise((r) => setTimeout(r, 5));
    const again = await post(app, "db_me", { welcomeSeen: true });
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().welcomeSeenAt, seenAt, "the first time is kept");
    const row = await prisma.user.findUnique({ where: { id: "db_me" } });
    assert.equal(new Date(row.welcomeSeenAt).toISOString(), seenAt);
  });

  test("tierCelebrated records a program tier, and repeating it changes nothing", async () => {
    const { app, prisma } = await buildApp();
    const res = await post(app, "db_me", { tierCelebrated: "NOODLE_MASTER" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().lastTierCelebrated, "NOODLE_MASTER");
    const again = await post(app, "db_me", { tierCelebrated: "NOODLE_MASTER" });
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().lastTierCelebrated, "NOODLE_MASTER");
    const row = await prisma.user.findUnique({ where: { id: "db_me" } });
    assert.equal(row.lastTierCelebrated, "NOODLE_MASTER");
    assert.equal(row.welcomeSeenAt ?? null, null, "welcome untouched");
  });

  test("both flags in one call", async () => {
    const { app } = await buildApp();
    const res = await post(app, "db_me", { welcomeSeen: true, tierCelebrated: "CHOPSTICK" });
    assert.equal(res.statusCode, 200);
    assert.ok(res.json().welcomeSeenAt);
    assert.equal(res.json().lastTierCelebrated, "CHOPSTICK");
  });

  test("400s a tier that isn't in the program", async () => {
    const { app, prisma } = await buildApp();
    for (const tierCelebrated of ["GOLD", "beef_boss", 3, null, ""]) {
      const res = await post(app, "db_me", { tierCelebrated });
      assert.equal(res.statusCode, 400, `tier ${JSON.stringify(tierCelebrated)}`);
    }
    const row = await prisma.user.findUnique({ where: { id: "db_me" } });
    assert.equal(row.lastTierCelebrated ?? null, null, "nothing written");
  });

  test("400s an empty body, welcomeSeen other than true, and unknown keys", async () => {
    const { app } = await buildApp();
    for (const payload of [{}, { welcomeSeen: false }, { welcomeSeen: "yes" }, { welcomeSeen: true, membershipTier: "BEEF_BOSS" }]) {
      const res = await post(app, "db_me", payload);
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
    }
  });

  test("404s a trusted service call for a user that doesn't exist", async () => {
    const { app } = await buildApp();
    const res = await post(app, "db_nobody", { welcomeSeen: true }, { "x-admin-api-key": "key-123" });
    assert.equal(res.statusCode, 404);
  });
});
