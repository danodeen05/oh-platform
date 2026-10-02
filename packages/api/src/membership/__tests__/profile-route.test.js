import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { createCustomerAuth, registerCustomerIdentity } from "../../auth/customer.js";
import { registerProfileRoute, referralDisplayName } from "../profile-route.js";

const FULL_REFERRALS = [
  { id: "r1", name: "Dana Smith", email: "dana@friend.com", phone: "+15551230001", createdAt: new Date("2026-09-01"), lifetimeOrderCount: 3 },
  { id: "r2", name: null, email: "anon@friend.com", phone: null, createdAt: new Date("2026-09-02"), lifetimeOrderCount: 0 },
];

/** A findUnique that honors `select` on referrals the way Prisma does, so a leaky select shows up. */
function stubPrisma() {
  return {
    user: {
      findUnique: async ({ include }) => {
        const sel = include.referrals.select;
        const referrals = FULL_REFERRALS.map((r) => Object.fromEntries(Object.keys(sel).filter((k) => sel[k]).map((k) => [k, r[k]])));
        return { id: "u1", email: "me@x.com", badges: [], challenges: [], referrals };
      },
    },
  };
}

async function build() {
  const app = Fastify({ logger: false });
  registerProfileRoute(app, {
    prisma: stubPrisma(),
    profileForUser: async () => ({ tier: "CHOPSTICK", progress: {}, badges: [] }),
    getLocale: () => "en",
    localizeBadge: (b) => b,
    localizeChallenge: (c) => c,
    isTrackableChallenge: () => true,
    legacyTierBenefits: () => ({}),
    legacyNextTier: () => null,
    legacyTierProgress: () => ({}),
  });
  await app.ready();
  return app;
}

describe("GET /users/:id/profile referrals privacy", () => {
  test("referrals carry no email or phone, only safe display fields", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/users/u1/profile" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.referrals.length, 2);
    for (const r of body.referrals) {
      assert.deepEqual(Object.keys(r).sort(), ["createdAt", "displayName", "id", "lifetimeOrderCount"]);
    }
    assert.equal(body.referrals[0].displayName, "Dana S.");
    assert.equal(body.referrals[1].displayName, "A friend");
    assert.equal(body.referrals[0].lifetimeOrderCount, 3);
    assert.ok(!res.body.includes("friend.com"), "no referred member's email anywhere in the response");
    assert.ok(!res.body.includes("+1555123"), "no referred member's phone anywhere in the response");
    assert.equal(body.email, "me@x.com", "the member's own fields are unchanged");
  });

  test("referralDisplayName", () => {
    assert.equal(referralDisplayName("Dana Smith"), "Dana S.");
    assert.equal(referralDisplayName("Dana"), "D.");
    assert.equal(referralDisplayName("王小明"), "王.");
    assert.equal(referralDisplayName("  mary  jane  watson "), "mary W.");
    assert.equal(referralDisplayName(""), "A friend");
  });
});

describe("self-only guard on the extracted route", () => {
  // Same wiring order as index.js: registerCustomerIdentity first (its onRoute
  // hook only guards routes registered after it), then registerProfileRoute.
  async function wired() {
    const auth = createCustomerAuth({
      env: { CLERK_SECRET_KEY: "sk_test_x", CHAPPY_GUEST_SECRET: "g" },
      verifyToken: async (token) => ({ sub: token.replace("clerk:", "") }),
      getUser: async () => ({ primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "me@x.com", verification: { status: "verified" } }] }),
      prisma: { user: { findFirst: async () => ({ id: "u1" }) } },
    });
    const app = Fastify({ logger: false });
    registerCustomerIdentity(app, auth);
    registerProfileRoute(app, {
      prisma: stubPrisma(),
      profileForUser: async () => ({ tier: "CHOPSTICK", progress: {}, badges: [] }),
      getLocale: () => "en",
      localizeBadge: (b) => b,
      localizeChallenge: (c) => c,
      isTrackableChallenge: () => true,
      legacyTierBenefits: () => ({}),
      legacyNextTier: () => null,
      legacyTierProgress: () => ({}),
    });
    await app.ready();
    return app;
  }

  test("403 for another member, 200 for self", async () => {
    const app = await wired();
    const headers = { authorization: "Bearer clerk:user_me" };
    const other = await app.inject({ method: "GET", url: "/users/u2/profile", headers });
    assert.equal(other.statusCode, 403);
    const self = await app.inject({ method: "GET", url: "/users/u1/profile", headers });
    assert.equal(self.statusCode, 200);
  });

  test("index.js registers the profile route after registerCustomerIdentity", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../index.js", import.meta.url), "utf8");
    const identity = src.indexOf("registerCustomerIdentity(app, customerAuth)");
    const profile = src.indexOf("registerProfileRoute(app,");
    assert.ok(identity > 0 && profile > identity);
  });
});
