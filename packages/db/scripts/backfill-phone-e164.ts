/**
 * One-off backfill (Task F2): normalizes existing `User.phone` and
 * `Guest.phone` rows to E.164, so Chappy SMS can match identity by exact
 * string equality instead of a loose digit-suffix comparison.
 *
 * A row that already normalizes to its own E.164 value is left untouched
 * (no-op update, not counted as "updated"). A row whose phone doesn't reduce
 * to a plausible E.164 number is logged and left as-is - this script never
 * guesses or drops data.
 *
 * `normalizePhoneE164` is imported directly from @oh/api's source (Task F2
 * fix round 1, controller ruling 2): this used to be a local copy that had
 * drifted from Chappy's (stricter) rule, so a number this script "fixed"
 * could then fail Chappy's exact-match identity check. There's no package.json
 * dependency from @oh/db on @oh/api - this is a plain relative-path import
 * of one pure, dependency-free function, which `tsx`/Node resolve at the
 * filesystem level regardless of package boundaries. Keep this path in sync
 * if packages/api/src/utils/phone.js ever moves.
 *
 * Usage (run from packages/db):
 *   pnpm exec tsx scripts/backfill-phone-e164.ts --dry-run
 *   pnpm exec tsx scripts/backfill-phone-e164.ts
 *
 * Guard: DATABASE_URL must point at 127.0.0.1/localhost unless
 * ALLOW_NON_LOCAL=1 (or the older ALLOW_NON_LOCAL_BACKFILL=1) is set. The
 * only remote run is the controller's prod cutover (Task G3 runbook).
 */
import { PrismaClient } from "@prisma/client";
import { normalizePhoneE164 } from "../../api/src/utils/phone.js";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";

function last4(phone: string | null | undefined): string {
  if (!phone) return "----";
  const digits = String(phone).replace(/\D/g, "");
  return digits.slice(-4) || "----";
}

export interface Counts {
  total: number;
  alreadyOk: number;
  updated: number;
  unparseable: number;
  conflicts: number;
}

function emptyCounts(): Counts {
  return { total: 0, alreadyOk: 0, updated: 0, unparseable: 0, conflicts: 0 };
}

export async function backfillTable(
  prisma: PrismaClient,
  label: "User" | "Guest",
  findMany: () => Promise<{ id: string; phone: string | null }[]>,
  update: (id: string, phone: string) => Promise<void>,
  dryRun: boolean,
  // User.phone is @unique in the schema; Guest.phone isn't. Two distinct raw
  // strings (e.g. "8015551234" and "+18015551234") can already coexist today
  // and would collide once both normalize to the same E.164 value - pass a
  // lookup for tables where that's possible so it's reported, not crashed on.
  findConflict?: (normalizedPhone: string, excludingId: string) => Promise<{ id: string } | null>,
): Promise<Counts> {
  const counts = emptyCounts();
  const rows = await findMany();
  // Tracks normalized values claimed earlier IN THIS RUN, so two rows that
  // collide with each other (not just with something already in the DB) are
  // both caught, even in --dry-run before either write actually happens.
  // Only meaningful where `findConflict` is given (User.phone is @unique);
  // Guest.phone isn't unique, so guests sharing a number is never a conflict.
  const claimedThisRun = new Map<string, string>(); // normalized phone -> row id
  for (const row of rows) {
    if (!row.phone) continue;
    counts.total++;
    const normalized = normalizePhoneE164(row.phone);
    if (normalized === null) {
      counts.unparseable++;
      console.log(`[backfill-phone] ${label} ${row.id}: can't parse "...${last4(row.phone)}" - left unchanged`);
      continue;
    }
    if (normalized === row.phone) {
      if (findConflict) claimedThisRun.set(normalized, row.id);
      counts.alreadyOk++;
      continue;
    }
    if (findConflict) {
      const claimedBy = claimedThisRun.get(normalized);
      const conflict = claimedBy ? { id: claimedBy } : await findConflict(normalized, row.id);
      if (conflict) {
        counts.conflicts++;
        console.log(`[backfill-phone] ${label} ${row.id}: normalizing to ...${last4(normalized)} would collide with ${label} ${conflict.id} - left unchanged, needs manual review`);
        continue;
      }
      claimedThisRun.set(normalized, row.id);
    }
    counts.updated++;
    console.log(`[backfill-phone]${dryRun ? " (dry-run)" : ""} ${label} ${row.id}: ...${last4(row.phone)} -> E.164 ...${last4(normalized)}`);
    if (!dryRun) await update(row.id, normalized);
  }
  return counts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Task G3: the shared guard (ALLOW_NON_LOCAL=1, or the older ALLOW_NON_LOCAL_BACKFILL=1).
  const target = requireSafeTarget("backfill-phone", process.env, ["ALLOW_NON_LOCAL_BACKFILL"]);
  console.log(targetBanner("backfill-phone", target, dryRun));

  const prisma = new PrismaClient();
  try {
    console.log(`[backfill-phone] Starting${dryRun ? " (--dry-run, no writes)" : ""}...`);

    const userCounts = await backfillTable(
      prisma,
      "User",
      () => prisma.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } }),
      (id, phone) => prisma.user.update({ where: { id }, data: { phone } }).then(() => undefined),
      dryRun,
      async (normalizedPhone, excludingId) => {
        const existing = await prisma.user.findFirst({ where: { phone: normalizedPhone, id: { not: excludingId } }, select: { id: true } });
        return existing;
      },
    );

    const guestCounts = await backfillTable(
      prisma,
      "Guest",
      () => prisma.guest.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } }),
      (id, phone) => prisma.guest.update({ where: { id }, data: { phone } }).then(() => undefined),
      dryRun,
      // Guest.phone has no unique constraint - multiple guests may legitimately share a number.
    );

    console.log("[backfill-phone] Summary:");
    console.log(`  User:  ${userCounts.total} with a phone, ${userCounts.alreadyOk} already E.164, ${userCounts.updated} ${dryRun ? "would be updated" : "updated"}, ${userCounts.unparseable} unparseable, ${userCounts.conflicts} conflicts (left unchanged)`);
    console.log(`  Guest: ${guestCounts.total} with a phone, ${guestCounts.alreadyOk} already E.164, ${guestCounts.updated} ${dryRun ? "would be updated" : "updated"}, ${guestCounts.unparseable} unparseable (left unchanged)`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error("[backfill-phone] Failed:", err?.message ?? err);
    process.exitCode = 1;
  });
}
