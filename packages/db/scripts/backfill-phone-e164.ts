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
 * `normalizePhoneE164` below is a deliberate copy of
 * packages/api/src/utils/phone.js's function of the same name: this script
 * lives in @oh/db, which has no dependency on @oh/api, and a one-off backfill
 * isn't worth a new cross-package dependency for. Keep the two in sync if the
 * rule ever changes.
 *
 * Usage (run from packages/db):
 *   pnpm exec tsx scripts/backfill-phone-e164.ts --dry-run
 *   pnpm exec tsx scripts/backfill-phone-e164.ts
 *
 * Dev-only guard: the worktree's DATABASE_URL must point at 127.0.0.1 (the
 * private oh_overhaul clone, never `ohdev` or prod - see packages/db's own
 * README and R2 in the controller rulings). This script refuses to run
 * against anything else unless ALLOW_NON_LOCAL_BACKFILL=1 is set.
 */
import { PrismaClient } from "@prisma/client";

const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

function normalizePhoneE164(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) return null;
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function last4(phone: string | null | undefined): string {
  if (!phone) return "----";
  const digits = String(phone).replace(/\D/g, "");
  return digits.slice(-4) || "----";
}

interface Counts {
  total: number;
  alreadyOk: number;
  updated: number;
  unparseable: number;
  conflicts: number;
}

function emptyCounts(): Counts {
  return { total: 0, alreadyOk: 0, updated: 0, unparseable: 0, conflicts: 0 };
}

async function backfillTable(
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
      counts.alreadyOk++;
      continue;
    }
    if (findConflict) {
      const conflict = await findConflict(normalized, row.id);
      if (conflict) {
        counts.conflicts++;
        console.log(`[backfill-phone] ${label} ${row.id}: normalizing to ...${last4(normalized)} would collide with ${label} ${conflict.id} - left unchanged, needs manual review`);
        continue;
      }
    }
    counts.updated++;
    console.log(`[backfill-phone]${dryRun ? " (dry-run)" : ""} ${label} ${row.id}: ...${last4(row.phone)} -> E.164 ...${last4(normalized)}`);
    if (!dryRun) await update(row.id, normalized);
  }
  return counts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const databaseUrl = process.env.DATABASE_URL || "";
  const isLocal = /(^|@)(127\.0\.0\.1|localhost)([:/]|$)/.test(databaseUrl);
  if (!isLocal && process.env.ALLOW_NON_LOCAL_BACKFILL !== "1") {
    console.error("[backfill-phone] DATABASE_URL doesn't look like the local oh_overhaul clone (127.0.0.1). Refusing to run.");
    console.error("[backfill-phone] Set ALLOW_NON_LOCAL_BACKFILL=1 to override (never against ohdev or prod).");
    process.exit(1);
  }

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

main().catch((err) => {
  console.error("[backfill-phone] Failed:", err);
  process.exitCode = 1;
});
