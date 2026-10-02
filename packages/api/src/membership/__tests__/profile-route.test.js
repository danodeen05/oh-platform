import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
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
    assert.equal(referralDisplayName("Dana"), "Dana");
    assert.equal(referralDisplayName("  mary  jane  watson "), "mary W.");
    assert.equal(referralDisplayName(""), "A friend");
  });
});
