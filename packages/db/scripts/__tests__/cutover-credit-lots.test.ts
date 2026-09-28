/**
 * Task G3: cutover-credit-lots. Legacy balances become LEGACY lots, and
 * every undisbursed PendingCredit is paid out as a REFERRAL lot and marked
 * disbursed. A dry run writes nothing; a real run is idempotent.
 * Uses the API's in-memory Prisma stub (the same one the credit ledger's
 * own tests use), so grantCredit/convertLegacyBalances run for real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMemoryPrisma } from "../../../api/src/__tests__/helpers/prisma-memory.js";
import { cutoverCreditLots } from "../cutover-credit-lots.ts";
import { noWrites } from "./helpers/no-writes.ts";

const NOW = new Date("2026-10-01T18:00:00Z");
const OLD = new Date("2026-09-01T00:00:00Z");

function seed() {
  return makeMemoryPrisma({
    users: [
      { id: "u_legacy", creditsCents: 26 }, // balance, no lots: gets a LEGACY lot
      { id: "u_ref", creditsCents: 0 }, // two undisbursed referral credits
      { id: "u_done", creditsCents: 500 }, // already converted in release 1
      { id: "u_both", creditsCents: 300 }, // legacy balance AND a pending referral
    ],
    creditLots: [{ id: "lot_done", userId: "u_done", source: "LEGACY", amountCents: 500, remainingCents: 500, expiresAt: new Date("2026-12-26T00:00:00Z") }],
    pendingCredits: [
      { id: "pc1", userId: "u_ref", type: "REFERRAL_ORDER", amountCents: 500, sourceOrderId: "ord_a", scheduledFor: OLD, disbursedAt: null, createdAt: OLD },
      { id: "pc2", userId: "u_ref", type: "REFERRAL_ORDER", amountCents: 500, sourceOrderId: "ord_b", scheduledFor: OLD, disbursedAt: null, createdAt: OLD },
      { id: "pc3", userId: "u_both", type: "REFERRAL_ORDER", amountCents: 500, sourceOrderId: null, scheduledFor: OLD, disbursedAt: null, createdAt: OLD },
      { id: "pc_old", userId: "u_ref", type: "REFERRAL_ORDER", amountCents: 500, scheduledFor: OLD, disbursedAt: OLD, createdAt: OLD }, // paid by the old cron
      { id: "pc_bad", userId: "u_ref", type: "REFERRAL_ORDER", amountCents: 0, scheduledFor: OLD, disbursedAt: null, createdAt: OLD }, // never payable
    ],
  });
}

async function lotsOf(prisma: any, userId: string) {
  return prisma.creditLot.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

test("dry run counts the work and writes nothing", async () => {
  const prisma = seed();
  const log: string[] = [];
  const counts = await cutoverCreditLots(noWrites(prisma, log), { dryRun: true, now: NOW });
  assert.deepEqual(log, [], "no write method was called");
  assert.equal(counts.legacyUsers, 2); // u_legacy, u_both
  assert.equal(counts.legacyCents, 326);
  assert.equal(counts.pendingFound, 4); // pc1, pc2, pc3, pc_bad
  assert.equal(counts.pendingPaid, 3);
  assert.equal(counts.pendingPaidCents, 1500);
  assert.equal(counts.pendingInvalid, 1);
  assert.equal((await prisma.creditLot.findMany({})).length, 1, "state unchanged");
  assert.equal((await prisma.pendingCredit.findMany({ where: { disbursedAt: null } })).length, 4);
});

test("real run converts legacy balances first, pays pending credit as REFERRAL lots, marks them disbursed", async () => {
  const prisma = seed();
  const counts = await cutoverCreditLots(prisma, { dryRun: false, now: NOW });
  assert.equal(counts.legacyUsers, 2);
  assert.equal(counts.pendingPaid, 3);
  assert.equal(counts.pendingPaidCents, 1500);
  assert.equal(counts.pendingInvalid, 1);
  assert.equal(counts.driftUsers, 0, "cached balances match the lots afterwards");

  const ref = await lotsOf(prisma, "u_ref");
  assert.equal(ref.length, 2);
  for (const lot of ref) {
    assert.equal(lot.source, "REFERRAL");
    assert.equal(lot.amountCents, 500);
    assert.equal(lot.remainingCents, 500);
    assert.equal(lot.expiresAt.getTime(), NOW.getTime() + 90 * 24 * 3600 * 1000);
  }
  assert.deepEqual(ref.map((l: any) => l.orderId).sort(), ["ord_a", "ord_b"]);
  assert.equal((await prisma.user.findUnique({ where: { id: "u_ref" } })).creditsCents, 1000);

  // u_both: the legacy 300 became a LEGACY lot before the referral lot, so neither is lost.
  const both = await lotsOf(prisma, "u_both");
  assert.deepEqual(both.map((l: any) => [l.source, l.amountCents]).sort(), [["LEGACY", 300], ["REFERRAL", 500]]);
  assert.equal((await prisma.user.findUnique({ where: { id: "u_both" } })).creditsCents, 800);

  // Already-converted user untouched; the old cron's row untouched; the 0-cent row left undisbursed.
  assert.equal((await lotsOf(prisma, "u_done")).length, 1);
  assert.equal((await prisma.pendingCredit.findUnique({ where: { id: "pc_old" } })).disbursedAt.getTime(), OLD.getTime());
  assert.equal((await prisma.pendingCredit.findUnique({ where: { id: "pc_bad" } })).disbursedAt, null);
  for (const id of ["pc1", "pc2", "pc3"]) {
    assert.equal((await prisma.pendingCredit.findUnique({ where: { id } })).disbursedAt.getTime(), NOW.getTime());
  }
  const events = await prisma.creditEvent.findMany({ where: { type: "REFERRAL_ORDER" } });
  assert.equal(events.length, 3);
});

test("a second real run is a no-op (idempotent)", async () => {
  const prisma = seed();
  await cutoverCreditLots(prisma, { dryRun: false, now: NOW });
  const lotsBefore = (await prisma.creditLot.findMany({})).length;
  const second = await cutoverCreditLots(prisma, { dryRun: false, now: new Date(NOW.getTime() + 3600_000) });
  assert.equal(second.legacyUsers, 0);
  assert.equal(second.pendingPaid, 0);
  assert.equal(second.pendingPaidCents, 0);
  assert.equal((await prisma.creditLot.findMany({})).length, lotsBefore);
  // and a dry run after it also reports nothing to do
  const dry = await cutoverCreditLots(noWrites(prisma), { dryRun: true, now: NOW });
  assert.equal(dry.legacyUsers + dry.pendingPaid, 0);
});

test("two concurrent real runs pay each pending credit once", async () => {
  const prisma = seed();
  await Promise.all([cutoverCreditLots(prisma, { dryRun: false, now: NOW }), cutoverCreditLots(prisma, { dryRun: false, now: NOW })]);
  assert.equal((await lotsOf(prisma, "u_ref")).length, 2);
  assert.equal((await prisma.user.findUnique({ where: { id: "u_ref" } })).creditsCents, 1000);
});

test("the no-writes guard itself trips on a write, including inside a transaction", async () => {
  const log: string[] = [];
  const guarded = noWrites(seed(), log);
  await assert.rejects(() => (guarded as any).user.update({ where: { id: "u_ref" }, data: { creditsCents: 1 } }));
  await assert.rejects(() => (guarded as any).$transaction((tx: any) => tx.pendingCredit.updateMany({ where: {}, data: {} })));
  assert.deepEqual(log, ["user.update", "pendingCredit.updateMany"]);
});

test("drift is reported (read-only) when a cached balance disagrees with its lots", async () => {
  const prisma = makeMemoryPrisma({
    users: [{ id: "u_x", creditsCents: 900 }],
    creditLots: [{ id: "l1", userId: "u_x", source: "LEGACY", amountCents: 500, remainingCents: 500, expiresAt: new Date("2026-12-01T00:00:00Z") }],
  });
  const counts = await cutoverCreditLots(noWrites(prisma), { dryRun: true, now: NOW });
  assert.equal(counts.driftUsers, 1);
  assert.equal(counts.driftCents, 400);
});
