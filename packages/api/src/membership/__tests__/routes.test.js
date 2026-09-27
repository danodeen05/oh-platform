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
