/**
 * Task G3: MealGift paidAt backfill. A pre-A6 gift gets paidAt only when
 * its funding is proven: a succeeded, unrefunded Stripe PaymentIntent with
 * the old flow's metadata ({type:"meal_gift", giverId, locationId}) for the
 * non-credit part, plus (optionally) the credit debit the old flow logged.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../../api/src/__tests__/helpers/prisma-memory.js";
import { backfillMealGiftPaidAt } from "../backfill-mealgift-paidat.ts";
import { noWrites } from "./helpers/no-writes.ts";

const BEFORE = new Date("2026-09-27T22:20:00Z");
const T = (iso: string) => new Date(iso);
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

function gift(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    giverId: "g1",
    locationId: "loc1",
    amountCents: 1999,
    status: "PENDING",
    paidAt: null,
    stripePaymentIntentId: null,
    createdAt: T("2026-09-20T18:00:00Z"),
    expiresAt: T("2026-09-21T03:00:00Z"),
    expiredAt: null,
    ...over,
  };
}

function pi(id: string, over: Record<string, any> = {}) {
  return {
    id,
    status: "succeeded",
    amount: 1999,
    currency: "usd",
    created: unix(T("2026-09-20T17:59:00Z")),
    metadata: { type: "meal_gift", giverId: "g1", locationId: "loc1" },
    latest_charge: { amount_refunded: 0 },
    ...over,
  };
}

function fakeStripe(intents: any[]) {
  const calls: string[] = [];
  return {
    calls,
    paymentIntents: {
      async search({ query }: { query: string }) {
        calls.push(`search ${query}`);
        const giver = /metadata\['giverId'\]:'([^']+)'/.exec(query)?.[1];
        return { data: intents.filter((p) => p.metadata?.giverId === giver).map((p) => ({ ...p, latest_charge: "ch_x" })), has_more: false };
      },
      async retrieve(id: string) {
        calls.push(`retrieve ${id}`);
        const found = intents.find((p) => p.id === id);
        if (!found) throw new Error("no such pi");
        return structuredClone(found);
      },
    },
  };
}

function world() {
  return makeMemoryPrisma({
    mealGifts: [
      gift("mg_card"), // card-funded: pi_ok matches
      gift("mg_mixed", { amountCents: 2500, createdAt: T("2026-09-21T18:00:00Z") }), // $5 credit + $20 card
      gift("mg_credit", { amountCents: 1599, createdAt: T("2026-09-22T18:00:00Z") }), // all credit
      gift("mg_nopay", { createdAt: T("2026-09-23T18:00:00Z") }), // no payment found
      gift("mg_refunded", { createdAt: T("2026-09-24T18:00:00Z") }), // payment refunded
      gift("mg_new", { createdAt: T("2026-09-28T18:00:00Z") }), // after release 1: out of scope
      gift("mg_expired", { status: "EXPIRED", createdAt: T("2026-09-26T18:00:00Z"), expiredAt: T("2026-09-28T04:00:00Z") }), // expired after release 1, unrefunded
    ],
    creditEvents: [
      { id: "ce1", userId: "g1", type: "CREDIT_APPLIED", amountCents: -500, metadata: { mealGiftId: "mg_mixed" } },
      { id: "ce2", userId: "g1", type: "CREDIT_APPLIED", amountCents: -1599, metadata: { mealGiftId: "mg_credit" } },
    ],
  });
}

function intents() {
  return [
    pi("pi_ok"),
    pi("pi_mixed", { amount: 2000, created: unix(T("2026-09-21T17:58:00Z")) }),
    pi("pi_refunded", { created: unix(T("2026-09-24T17:59:00Z")), latest_charge: { amount_refunded: 1999 } }),
    pi("pi_expired", { created: unix(T("2026-09-26T17:59:00Z")) }),
    pi("pi_wrong_loc", { created: unix(T("2026-09-23T17:59:00Z")), metadata: { type: "meal_gift", giverId: "g1", locationId: "other" } }),
  ];
}

const quiet = async <R>(fn: () => Promise<R>): Promise<R> => {
  const orig = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = orig;
  }
};

test("dry run verifies with Stripe (read only) and writes nothing", async () => {
  const prisma = world();
  const log: string[] = [];
  const counts = await quiet(() => backfillMealGiftPaidAt(noWrites(prisma, log), fakeStripe(intents()), { dryRun: true, before: BEFORE }));
  assert.deepEqual(log, []);
  assert.equal(counts.scanned, 6);
  assert.equal(counts.stripeVerified, 3); // mg_card, mg_mixed, mg_expired
  assert.equal(counts.creditFunded, 1);
  assert.equal(counts.unverified, 2); // mg_nopay (wrong location only), mg_refunded
  assert.equal(counts.applied, 3);
  assert.equal(counts.expiredAfterBeforeUnrefunded, 1);
  assert.equal((await prisma.mealGift.findMany({ where: { paidAt: { not: null } } })).length, 0);
});

test("real run sets paidAt and binds the PaymentIntent only for verified gifts; credit-only gifts need the flag", async () => {
  const prisma = world();
  const counts = await quiet(() => backfillMealGiftPaidAt(prisma, fakeStripe(intents()), { dryRun: false, before: BEFORE }));
  assert.equal(counts.applied, 3);
  const get = (id: string) => prisma.mealGift.findUnique({ where: { id } });
  const card = await get("mg_card");
  assert.equal(card.stripePaymentIntentId, "pi_ok");
  assert.equal(card.paidAt.getTime(), T("2026-09-20T17:59:00Z").getTime());
  assert.equal((await get("mg_mixed")).stripePaymentIntentId, "pi_mixed");
  assert.equal((await get("mg_credit")).paidAt, null, "credit-funded gifts wait for --accept-credit-funded");
  assert.equal((await get("mg_nopay")).paidAt, null);
  assert.equal((await get("mg_refunded")).paidAt, null);
  assert.equal((await get("mg_new")).paidAt, null, "out of scope");

  const withFlag = await quiet(() => backfillMealGiftPaidAt(prisma, fakeStripe(intents()), { dryRun: false, before: BEFORE, acceptCreditFunded: true }));
  assert.equal(withFlag.applied, 1);
  const credit = await get("mg_credit");
  assert.equal(credit.paidAt.getTime(), credit.createdAt.getTime());
  assert.equal(credit.stripePaymentIntentId, null);
});

test("a second real run is a no-op (bound gifts drop out of scope)", async () => {
  const prisma = world();
  await quiet(() => backfillMealGiftPaidAt(prisma, fakeStripe(intents()), { dryRun: false, before: BEFORE, acceptCreditFunded: true }));
  const stripe = fakeStripe(intents());
  const second = await quiet(() => backfillMealGiftPaidAt(noWrites(prisma), stripe, { dryRun: false, before: BEFORE, acceptCreditFunded: true }));
  assert.equal(second.applied, 0);
  assert.equal(second.scanned, 2, "only the two unverifiable gifts are left to look at");
});

test("one PaymentIntent never funds two gifts, and an ambiguous match is left alone", async () => {
  const prisma = makeMemoryPrisma({
    mealGifts: [
      gift("a", { createdAt: T("2026-09-20T18:00:00Z") }),
      gift("b", { createdAt: T("2026-09-20T18:01:00Z") }),
      gift("bound", { paidAt: T("2026-09-19T00:00:00Z"), stripePaymentIntentId: "pi_taken", createdAt: T("2026-09-19T00:00:00Z") }),
    ],
  });
  // Two gifts a minute apart, two equal PaymentIntents: which paid which is unknowable, so both stay unverified.
  const twins = [pi("pi_1", { created: unix(T("2026-09-20T17:59:30Z")) }), pi("pi_2", { created: unix(T("2026-09-20T17:59:40Z")) })];
  const counts = await quiet(() => backfillMealGiftPaidAt(prisma, fakeStripe(twins), { dryRun: false, before: BEFORE }));
  assert.equal(counts.applied, 0);
  assert.equal(counts.ambiguous, 2);

  const prisma2 = makeMemoryPrisma({ mealGifts: [gift("c"), gift("bound", { paidAt: T("2026-09-19T00:00:00Z"), stripePaymentIntentId: "pi_taken", createdAt: T("2026-09-19T00:00:00Z") })] });
  const taken = [pi("pi_taken")];
  const c2 = await quiet(() => backfillMealGiftPaidAt(prisma2, fakeStripe(taken), { dryRun: false, before: BEFORE }));
  assert.equal(c2.applied, 0, "a PaymentIntent already bound to another gift is not reused");
  assert.equal(c2.unverified, 1);
});

test("the Stripe key mode must match the database (live for remote, test for local)", async () => {
  const { assertStripeMode } = await import("../backfill-mealgift-paidat.ts");
  assert.throws(() => assertStripeMode("sk_test_x", false), /live/);
  assert.throws(() => assertStripeMode("sk_live_x", true), /test/);
  assert.doesNotThrow(() => assertStripeMode("rk_live_x", false));
  assert.doesNotThrow(() => assertStripeMode("sk_test_x", true));
  assert.throws(() => assertStripeMode(undefined, true), /STRIPE_SECRET_KEY/);
});
