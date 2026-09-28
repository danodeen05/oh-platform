/**
 * Task G3 fix round 1: put the pods back the way release 1 shows them.
 *
 * Release-1 code lists EVERY Seat row of a location (no `retiredAt` filter)
 * and only claims rows with `retiredAt IS NULL`. After `seed-comb-seats` the
 * two comb locations hold 75/70 comb pods plus the retired pre-comb seats.
 * This script, per live comb location (resolved by slug, closed rows refused):
 *  - un-retires the pre-comb seats (any seat whose number is not a comb
 *    label like "B-07"; with `--retired-at=ISO`, only those retired at that
 *    exact time, the timestamp seed-comb-seats printed);
 *  - removes the comb pods from release 1's view: a comb pod no order or pod
 *    call references is DELETED (seed-comb-seats recreates it with the same
 *    label and QR code), and a referenced one is retired with status CLEANING
 *    so it is never offered. `--keep-unused` retires them all instead of
 *    deleting (release 1 then still lists them, as CLEANING).
 * It refuses to run while an order that is not finished sits on a comb pod.
 *
 * Everything runs in ONE transaction. The plan (counts) is printed before any
 * write, the result is checked inside the transaction (no active comb pod
 * left, the legacy pods active), and a failed check rolls everything back.
 * `--dry-run` prints the plan and writes nothing.
 *
 * Forward again: run `seed-comb-seats --all` (it recreates or revives the
 * comb pods as AVAILABLE and retires the pre-comb seats).
 *
 * Usage (from packages/db):
 *   pnpm exec tsx scripts/seat-rollback-release1.ts --dry-run [--retired-at=ISO]
 *   pnpm exec tsx scripts/seat-rollback-release1.ts [--retired-at=ISO] [--keep-unused]
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { PrismaClient } from "@prisma/client";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";
import { LOCATIONS } from "./seed-comb-seats.ts";

const COMB_LABEL = /^[A-Z]-\d{2}$/;
const IN_FLIGHT = ["PENDING_PAYMENT", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"];

export interface SeatRollbackCounts {
  [slug: string]: { legacyRevived: number; combDeleted: number; combRetired: number; legacyActiveAfter: number; combActiveAfter: number };
}

export async function planAndRollbackSeats(
  prisma: any,
  { dryRun, now = new Date(), retiredAt, keepUnused = false, log = console.log }: { dryRun: boolean; now?: Date; retiredAt?: Date; keepUnused?: boolean; log?: (s: string) => void },
): Promise<SeatRollbackCounts> {
  const work = async (db: any) => {
    const out: SeatRollbackCounts = {};
    const plans: { slug: string; locationId: string; revive: string[]; del: string[]; retire: string[]; legacyActive: number }[] = [];

    for (const entry of LOCATIONS) {
      // eslint-disable-next-line no-await-in-loop
      const loc = await db.location.findUnique({ where: { slug: entry.slug } });
      if (!loc) throw new Error(`${entry.slug}: no location has this slug (was seed-comb-seats run?)`);
      if (loc.isClosed) throw new Error(`${entry.slug}: the row holding this slug is closed`);
      // eslint-disable-next-line no-await-in-loop
      const seats = await db.seat.findMany({ where: { locationId: loc.id } });
      const legacy = seats.filter((s: any) => !COMB_LABEL.test(String(s.number)));
      const comb = seats.filter((s: any) => COMB_LABEL.test(String(s.number)) && s.retiredAt === null);
      const revive = legacy
        .filter((s: any) => s.retiredAt !== null && (!retiredAt || s.retiredAt.getTime() === retiredAt.getTime()))
        .map((s: any) => s.id);
      const combIds = comb.map((s: any) => s.id);

      // eslint-disable-next-line no-await-in-loop
      const orders = combIds.length
        ? await db.order.findMany({ where: { OR: [{ seatId: { in: combIds } }, { dualPartnerSeatId: { in: combIds } }] }, select: { seatId: true, dualPartnerSeatId: true, status: true } })
        : [];
      const busy = orders.filter((o: any) => IN_FLIGHT.includes(o.status));
      if (busy.length) throw new Error(`${entry.slug}: ${busy.length} unfinished order(s) sit on comb pods. Finish or move them first.`);
      // eslint-disable-next-line no-await-in-loop
      const calls = combIds.length ? await db.podCall.findMany({ where: { seatId: { in: combIds } }, select: { seatId: true } }) : [];
      const referenced = new Set<string>([...orders.flatMap((o: any) => [o.seatId, o.dualPartnerSeatId]), ...calls.map((c: any) => c.seatId)].filter(Boolean));
      const del = keepUnused ? [] : combIds.filter((id: string) => !referenced.has(id));
      const retire = combIds.filter((id: string) => !del.includes(id));
      const legacyActive = legacy.filter((s: any) => s.retiredAt === null).length + revive.length;
      plans.push({ slug: entry.slug, locationId: loc.id, revive, del, retire, legacyActive });
      out[entry.slug] = { legacyRevived: revive.length, combDeleted: del.length, combRetired: retire.length, legacyActiveAfter: legacyActive, combActiveAfter: 0 };
    }

    log(`[seat-rollback]${dryRun ? " [dry run]" : ""} plan ${JSON.stringify(out)}`);
    if (dryRun) return out;

    for (const p of plans) {
      if (p.revive.length) {
        // eslint-disable-next-line no-await-in-loop
        await db.seat.updateMany({ where: { id: { in: p.revive } }, data: { retiredAt: null } });
      }
      if (p.del.length) {
        // eslint-disable-next-line no-await-in-loop -- clear duo links pointing at a pod before deleting it
        await db.seat.updateMany({ where: { dualPartnerId: { in: p.del } }, data: { dualPartnerId: null } });
        // eslint-disable-next-line no-await-in-loop
        await db.seat.deleteMany({ where: { id: { in: p.del } } });
      }
      if (p.retire.length) {
        // eslint-disable-next-line no-await-in-loop
        await db.seat.updateMany({ where: { id: { in: p.retire } }, data: { retiredAt: now, status: "CLEANING" } });
      }
      // Check inside the transaction; a throw rolls the whole run back.
      // eslint-disable-next-line no-await-in-loop
      const after = await db.seat.findMany({ where: { locationId: p.locationId, retiredAt: null } });
      const combActive = after.filter((s: any) => COMB_LABEL.test(String(s.number))).length;
      const legacyActive = after.length - combActive;
      if (combActive !== 0 || legacyActive !== p.legacyActive) {
        throw new Error(`${p.slug}: check failed after the writes (active comb ${combActive}, active legacy ${legacyActive}, expected 0 and ${p.legacyActive}); rolled back`);
      }
      out[p.slug].combActiveAfter = combActive;
      out[p.slug].legacyActiveAfter = legacyActive;
    }
    log(`[seat-rollback] checked, committing ${JSON.stringify(out)}`);
    return out;
  };
  return dryRun ? work(prisma) : prisma.$transaction((tx: any) => work(tx), { timeout: 60_000 });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const keepUnused = process.argv.includes("--keep-unused");
  const arg = process.argv.find((a) => a.startsWith("--retired-at="));
  const retiredAt = arg ? new Date(arg.slice("--retired-at=".length)) : undefined;
  if (retiredAt && Number.isNaN(retiredAt.getTime())) throw new Error("--retired-at must be an ISO date");
  const target = requireSafeTarget("seat-rollback");
  console.log(`${targetBanner("seat-rollback", target, dryRun)}${retiredAt ? ` retired-at ${retiredAt.toISOString()}` : ""}${keepUnused ? " --keep-unused" : ""}`);
  const prisma = new PrismaClient();
  try {
    const counts = await planAndRollbackSeats(prisma, { dryRun, retiredAt, keepUnused });
    console.log(`[seat-rollback]${dryRun ? " [dry run]" : " committed"} ${JSON.stringify(counts)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[seat-rollback] failed, nothing written: ${err?.message ?? err}`);
    process.exit(1);
  });
}
