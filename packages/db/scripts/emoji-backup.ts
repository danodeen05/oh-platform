/**
 * Task G3 fix round 1: Badge/Challenge `iconEmoji` backup (taken by
 * `backfill-i18n --clear-emoji`) and its restore, for the rollback.
 *
 * Backup: every Badge/Challenge with a non-empty emoji, by slug, to a JSON
 * file. It refuses to overwrite an existing file (a second clear would
 * otherwise replace the real backup with an empty one).
 *
 * Restore (`--from=<file>`): puts each emoji back ONLY where the row's emoji
 * is still empty (a row someone edited since is left alone), in one
 * transaction; the counts are printed before it commits. `--dry-run` writes
 * nothing.
 *
 * Usage (from packages/db):
 *   pnpm exec tsx scripts/emoji-backup.ts --from=<backup.json> --dry-run
 *   pnpm exec tsx scripts/emoji-backup.ts --from=<backup.json>
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";

export interface EmojiBackup {
  takenAt: string;
  badges: { slug: string; iconEmoji: string }[];
  challenges: { slug: string; iconEmoji: string }[];
}

export async function takeEmojiBackup(prisma: any, file: string, now = new Date()): Promise<EmojiBackup> {
  if (existsSync(file)) throw new Error(`${file} already exists; refusing to overwrite a backup`);
  const badges = (await prisma.badge.findMany({ select: { slug: true, iconEmoji: true } })).filter((b: any) => b.slug && b.iconEmoji).map((b: any) => ({ slug: b.slug, iconEmoji: b.iconEmoji }));
  const challenges = (await prisma.challenge.findMany({ select: { slug: true, iconEmoji: true } })).filter((c: any) => c.slug && c.iconEmoji).map((c: any) => ({ slug: c.slug, iconEmoji: c.iconEmoji }));
  const backup: EmojiBackup = { takenAt: now.toISOString(), badges, challenges };
  writeFileSync(file, `${JSON.stringify(backup, null, 2)}\n`, { flag: "wx" });
  return backup;
}

export async function restoreEmoji(prisma: any, backup: EmojiBackup, { dryRun, log = console.log }: { dryRun: boolean; log?: (s: string) => void }) {
  const work = async (db: any) => {
    const counts = { badges: 0, challenges: 0, skippedEdited: 0 };
    const todo: { model: "badge" | "challenge"; slug: string; iconEmoji: string }[] = [];
    for (const b of backup.badges) {
      // eslint-disable-next-line no-await-in-loop
      const row = await db.badge.findUnique({ where: { slug: b.slug } });
      if (row && !row.iconEmoji) todo.push({ model: "badge", ...b });
      else counts.skippedEdited++;
    }
    for (const c of backup.challenges) {
      // eslint-disable-next-line no-await-in-loop
      const row = await db.challenge.findUnique({ where: { slug: c.slug } });
      if (row && !row.iconEmoji) todo.push({ model: "challenge", ...c });
      else counts.skippedEdited++;
    }
    counts.badges = todo.filter((t) => t.model === "badge").length;
    counts.challenges = todo.filter((t) => t.model === "challenge").length;
    log(`[emoji-restore]${dryRun ? " [dry run]" : ""} plan ${JSON.stringify(counts)}`);
    if (dryRun) return counts;
    for (const t of todo) {
      // eslint-disable-next-line no-await-in-loop -- conditional: only a still-empty emoji is restored
      await db[t.model].updateMany({ where: { slug: t.slug, iconEmoji: t.model === "badge" ? null : "" }, data: { iconEmoji: t.iconEmoji } });
    }
    log(`[emoji-restore] committing ${JSON.stringify(counts)}`);
    return counts;
  };
  return dryRun ? work(prisma) : prisma.$transaction((tx: any) => work(tx));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const from = process.argv.find((a) => a.startsWith("--from="))?.slice("--from=".length);
  if (!from) throw new Error("--from=<backup.json> is required");
  const backup = JSON.parse(readFileSync(from, "utf8")) as EmojiBackup;
  if (!Array.isArray(backup.badges) || !Array.isArray(backup.challenges)) throw new Error("not an emoji backup file");
  const target = requireSafeTarget("emoji-restore");
  console.log(targetBanner("emoji-restore", target, dryRun));
  const prisma = new PrismaClient();
  try {
    await restoreEmoji(prisma, backup, { dryRun });
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[emoji-restore] failed, nothing written: ${err?.message ?? err}`);
    process.exit(1);
  });
}
