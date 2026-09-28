/**
 * Final review I3 (F1 SAFETY RULING): "Classic Beef Noodle Soup (no beef)"
 * is made with beef-bone broth, but the prod row is flagged vegan. The new
 * menu (apps/web/lib/site/menu.ts dietary marks) and Chappy (chappy/tools.js
 * menuSummary `dietary` and the dietary filter) both read `MenuItem.isVegan`
 * and `MenuItem.isVegetarian` straight from this row, so they would state it.
 *
 * This sets BOTH flags to false (beef-bone broth is not vegetarian either;
 * the fixed seed, prisma/seed-prod.ts, has isVegetarian false and no isVegan)
 * on exactly one row, matched by id AND name. It refuses (non-zero exit,
 * nothing written) when the id is missing or its name differs, so a renamed
 * or re-used id is never touched. The write is a conditional updateMany on
 * id + name, so it is idempotent: a re-run reports `alreadyCorrect`.
 *
 * Usage (from packages/db, DATABASE_URL in the env):
 *   pnpm exec tsx scripts/fix-no-beef-vegan-flag.ts --dry-run
 *   pnpm exec tsx scripts/fix-no-beef-vegan-flag.ts
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { PrismaClient } from "@prisma/client";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";

export const NO_BEEF_ID = "cmip6jbzc000a2nnnewnr00lb";
export const NO_BEEF_NAME = "Classic Beef Noodle Soup (no beef)";

export interface VeganFixResult {
  action: "would-fix" | "fixed" | "already-correct";
  before: { isVegan: boolean; isVegetarian: boolean };
}

export async function fixNoBeefVeganFlag(
  prisma: any,
  { dryRun, id = NO_BEEF_ID, name = NO_BEEF_NAME }: { dryRun: boolean; id?: string; name?: string },
): Promise<VeganFixResult> {
  const row = await prisma.menuItem.findUnique({ where: { id }, select: { id: true, name: true, isVegan: true, isVegetarian: true } });
  if (!row) throw new Error(`menu item ${id} not found; refusing (nothing written)`);
  if (row.name !== name) throw new Error(`menu item ${id} is named ${JSON.stringify(row.name)}, not ${JSON.stringify(name)}; refusing (nothing written)`);
  const before = { isVegan: Boolean(row.isVegan), isVegetarian: Boolean(row.isVegetarian) };
  if (!before.isVegan && !before.isVegetarian) return { action: "already-correct", before };
  if (dryRun) return { action: "would-fix", before };
  const res = await prisma.menuItem.updateMany({ where: { id, name }, data: { isVegan: false, isVegetarian: false } });
  if (res.count !== 1) throw new Error(`expected to update 1 row, updated ${res.count}`);
  return { action: "fixed", before };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const target = requireSafeTarget("fix-no-beef-vegan-flag");
  console.log(targetBanner("fix-no-beef-vegan-flag", target, dryRun));
  const prisma = new PrismaClient();
  try {
    const res = await fixNoBeefVeganFlag(prisma, { dryRun });
    console.log(`[fix-no-beef-vegan-flag]${dryRun ? " [dry run]" : ""} ${NO_BEEF_ID} ${JSON.stringify(res)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[fix-no-beef-vegan-flag] failed: ${err?.message ?? err}`);
    process.exit(1);
  });
}
