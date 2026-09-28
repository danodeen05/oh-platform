/**
 * Task G3: MealGift paidAt backfill and the return of funded gifts that
 * expired unclaimed (fix round 1 ruling). A pre-A6 gift is touched only when
 * its funding is proven: a succeeded, unrefunded Stripe PaymentIntent with
 * the old flow's metadata ({type:"meal_gift", giverId, locationId}) for the
 * card part, plus the credit debit the old flow logged for the rest.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../../api/src/__tests__/helpers/prisma-memory.js";
import { backfillMealGiftPaidAt, isReturnable, RETURN_NOTE } from "../backfill-mealgift-paidat.ts";
import { noWrites } from "./helpers/no-writes.ts";

const BEFORE = new Date("2026-09-27T22:20:00Z");
const NOW = new Date("2026-10-01T06:00:00Z");
const T = (iso: string) => new Date(iso);
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

function gift(id: string, day: number, over: Record<string, unknown> = {}) {
  const created = T(`2026-09-${String(day).padStart(2, "0")}T18:00:00Z`);
  return {
    id,
    giverId: "g1",
    locationId: "loc1",
    amountCents: 1999,
    status: "ACCEPTED",
    paidAt: null,
    stripePaymentIntentId: null,
    createdAt: created,
    expiresAt: new Date(created.getTime() + 9 * 3600_000),
    expiredAt: null,
    ...over,
  };
}

function pi(id: string, day: number, over: Record<string, any> = {}) {
  return {
    id,
    status: "succeeded",
    amount: 1999,
    currency: "usd",
    created: unix(T(`2026-09-${String(day).padStart(2, "0")}T17:59:00Z`)),
    metadata: { type: "meal_gift", giverId: "g1", locationId: "loc1" },
    latest_charge: { amount_refunded: 0 },
    ...over,
  };
}

function fakeStripe(intents: any[]) {
  return {
    paymentIntents: {
      async search({ query }: { query: string }) {
        const giver = /metadata\['giverId'\]:'([^']+)'/.exec(query)?.[1];
        return { data: intents.filter((p) => p.metadata?.giverId === giver).map((p) => ({ ...p, latest_charge: "ch_x" })), has_more: false };
      },
      async retrieve(id: string) {
        const found = intents.find((p) => p.id === id);
        if (!found) throw new Error("no such pi");
        return structuredClone(found);
      },
    },
  };
}

const AFTER_RELEASE = T("2026-09-28T04:00:00Z");

function world() {
  return makeMemoryPrisma({
    users: [{ id: "g1", creditsCents: 0 }],
    mealGifts: [
      gift("mg_card", 10), // accepted, card: paidAt only
      gift("mg_mixed", 11, { amountCents: 2500 }), // accepted, $5 credit + $20 card: paidAt only
      gift("mg_credit", 12, { amountCents: 1599, status: "EXPIRED", expiredAt: AFTER_RELEASE }), // all credit, expired after release 1: RETURN
      gift("mg_nopay", 13, { status: "PENDING" }), // past expiry, wrong-location PI only: unverified
      gift("mg_refunded", 14), // PI refunded: unverified
      gift("mg_expired", 15, { status: "EXPIRED", expiredAt: AFTER_RELEASE }), // card, expired after release 1: RETURN
      gift("mg_pending_past", 16, { status: "PENDING" }), // card, still PENDING past expiry: RETURN
      gift("mg_old_expired", 17, { status: "EXPIRED", expiredAt: T("2026-09-18T04:00:00Z") }), // expired before release 1 (old code's "refund" never landed): RETURN
      gift("mg_new", 28), // created after release 1: out of scope
    ],
    creditEvents: [
      { id: "ce1", userId: "g1", type: "CREDIT_APPLIED", amountCents: -500, metadata: { mealGiftId: "mg_mixed" } },
      { id: "ce2", userId: "g1", type: "CREDIT_APPLIED", amountCents: -1599, metadata: { mealGiftId: "mg_credit" } },
    ],
  });
}

function intents() {
  return [
    pi("pi_card", 10),
    pi("pi_mixed", 11, { amount: 2000 }),
    pi("pi_wrong_loc", 13, { metadata: { type: "meal_gift", giverId: "g1", locationId: "other" } }),
    pi("pi_refunded", 14, { latest_charge: { amount_refunded: 1999 } }),
    pi("pi_expired", 15),
    pi("pi_pending", 16),
    pi("pi_old", 17),
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

const run = (prisma: any, dryRun: boolean) => quiet(() => backfillMealGiftPaidAt(prisma, fakeStripe(intents()), { dryRun, before: BEFORE, now: NOW }));

test("isReturnable: any EXPIRED gift (before or after release 1), or PENDING past expiry", () => {
  assert.equal(isReturnable({ status: "EXPIRED", expiredAt: AFTER_RELEASE }, NOW), true);
  assert.equal(isReturnable({ status: "EXPIRED", expiredAt: T("2026-09-01T00:00:00Z") }, NOW), true);
  assert.equal(isReturnable({ status: "PENDING", expiresAt: T("2026-09-30T00:00:00Z") }, NOW), true);
  assert.equal(isReturnable({ status: "PENDING", expiresAt: T("2026-10-02T00:00:00Z") }, NOW), false);
  assert.equal(isReturnable({ status: "ACCEPTED" }, NOW), false);
});

test("dry run counts returns (credit-funded included) and backfills, and writes nothing", async () => {
  const prisma = world();
  const log: string[] = [];
  const counts = await run(noWrites(prisma, log), true);
  assert.deepEqual(log, []);
  assert.deepEqual(counts, {
    scanned: 8,
    stripeVerified: 5, // card, mixed, expired, pending_past, old_expired
    creditFunded: 1,
    ambiguous: 0,
    unverified: 2, // nopay, refunded
    applied: 2, // card, mixed
    returned: 4, // credit, expired, pending_past, old_expired
    returnedCents: 1599 + 1999 * 3,
    lapsedFundedReturned: 0,
    unverifiedExpired: 1, // nopay
  });
  assert.equal((await prisma.creditLot.findMany({})).length, 0);
});

test("real run returns each funded expired gift once as MEAL_GIFT credit, and only backfills the rest", async () => {
  const prisma = world();
  const counts = await run(prisma, false);
  assert.equal(counts.returned, 4);
  assert.equal(counts.applied, 2);

  const lots = await prisma.creditLot.findMany({ where: { userId: "g1" } });
  assert.deepEqual(lots.map((l: any) => [l.source, l.amountCents]).sort(), [["MEAL_GIFT", 1599], ["MEAL_GIFT", 1999], ["MEAL_GIFT", 1999], ["MEAL_GIFT", 1999]]);
  assert.ok(lots.every((l: any) => l.note === RETURN_NOTE));
  const events = await prisma.creditEvent.findMany({ where: { type: "REFUND_RESTORE" } });
  assert.equal(events.length, 4);
  assert.equal((await prisma.user.findUnique({ where: { id: "g1" } })).creditsCents, 1599 + 1999 * 3);

  const get = (id: string) => prisma.mealGift.findUnique({ where: { id } });
  const pending = await get("mg_pending_past");
  assert.equal(pending.status, "EXPIRED");
  assert.equal(pending.stripePaymentIntentId, "pi_pending");
  assert.equal(pending.expiredAt.getTime(), NOW.getTime());
  assert.equal((await get("mg_expired")).expiredAt.getTime(), AFTER_RELEASE.getTime(), "an existing expiredAt is kept");
  assert.equal((await get("mg_credit")).paidAt.getTime(), T("2026-09-12T18:00:00Z").getTime());
  assert.equal((await get("mg_card")).stripePaymentIntentId, "pi_card");
  assert.equal((await get("mg_card")).status, "ACCEPTED");
  const old = await get("mg_old_expired");
  assert.equal(old.stripePaymentIntentId, "pi_old");
  assert.equal(old.expiredAt.getTime(), T("2026-09-18T04:00:00Z").getTime(), "the original expiry is kept");
  assert.equal((await get("mg_nopay")).paidAt, null);
  assert.equal((await get("mg_refunded")).paidAt, null);
  assert.equal((await get("mg_new")).paidAt, null);
});

test("a second real run returns nothing and writes nothing (idempotent)", async () => {
  const prisma = world();
  await run(prisma, false);
  const second = await run(noWrites(prisma), false);
  assert.equal(second.returned, 0);
  assert.equal(second.applied, 0);
  assert.equal(second.scanned, 2, "only the unprovable gifts remain");
  assert.equal((await prisma.creditLot.findMany({})).length, 4);
});

test("the claim is the key: two concurrent runs return each gift once", async () => {
  const prisma = world();
  await Promise.all([run(prisma, false), run(prisma, false)]);
  assert.equal((await prisma.creditLot.findMany({})).length, 4);
  assert.equal((await prisma.user.findUnique({ where: { id: "g1" } })).creditsCents, 1599 + 1999 * 3);
});

test("a funded (paidAt set) gift still PENDING past expiry is returned once, sharing the expire endpoint's claim", async () => {
  const paid = T("2026-09-29T18:00:00Z");
  const prisma = makeMemoryPrisma({
    users: [{ id: "g2", creditsCents: 0 }],
    mealGifts: [
      gift("post_lapsed", 29, { giverId: "g2", status: "PENDING", paidAt: paid, stripePaymentIntentId: "pi_p1", amountCents: 2500 }),
      gift("post_open", 30, { giverId: "g2", status: "PENDING", paidAt: paid, stripePaymentIntentId: "pi_p2", expiresAt: T("2026-10-02T03:00:00Z") }),
      gift("post_done", 29, { giverId: "g2", status: "EXPIRED", paidAt: paid, stripePaymentIntentId: "pi_p3", expiredAt: T("2026-09-30T04:00:00Z") }),
    ],
  });
  const dry = await quiet(() => backfillMealGiftPaidAt(noWrites(prisma), fakeStripe([]), { dryRun: true, before: BEFORE, now: NOW }));
  assert.equal(dry.lapsedFundedReturned, 1);
  assert.equal(dry.returnedCents, 2500);
  const real = await run(prisma, false);
  assert.equal(real.lapsedFundedReturned, 1);
  const lapsed = await prisma.mealGift.findUnique({ where: { id: "post_lapsed" } });
  assert.equal(lapsed.status, "EXPIRED");
  assert.equal((await prisma.mealGift.findUnique({ where: { id: "post_open" } })).status, "PENDING", "not yet expired");
  assert.equal((await prisma.user.findUnique({ where: { id: "g2" } })).creditsCents, 2500, "the already-expired post-A6 gift was refunded by the endpoint, not again here");
  // The endpoint's claim (status PENDING) now fails, and a re-run finds nothing.
  assert.equal((await prisma.mealGift.updateMany({ where: { id: "post_lapsed", status: "PENDING" }, data: { status: "EXPIRED" } })).count, 0);
  assert.equal((await run(noWrites(prisma), false)).returned, 0);
});

test("one PaymentIntent never funds two gifts, and an ambiguous match is left alone", async () => {
  const prisma = makeMemoryPrisma({
    mealGifts: [
      gift("a", 20, { createdAt: T("2026-09-20T18:00:00Z") }),
      gift("b", 20, { createdAt: T("2026-09-20T18:01:00Z") }),
    ],
  });
  const twins = [pi("pi_1", 20, { created: unix(T("2026-09-20T17:59:30Z")) }), pi("pi_2", 20, { created: unix(T("2026-09-20T17:59:40Z")) })];
  const counts = await quiet(() => backfillMealGiftPaidAt(prisma, fakeStripe(twins), { dryRun: false, before: BEFORE, now: NOW }));
  assert.equal(counts.applied, 0);
  assert.equal(counts.ambiguous, 2);

  const prisma2 = makeMemoryPrisma({ mealGifts: [gift("c", 10), gift("bound", 9, { paidAt: T("2026-09-09T18:00:00Z"), stripePaymentIntentId: "pi_taken" })] });
  const c2 = await quiet(() => backfillMealGiftPaidAt(prisma2, fakeStripe([pi("pi_taken", 10)]), { dryRun: false, before: BEFORE, now: NOW }));
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
