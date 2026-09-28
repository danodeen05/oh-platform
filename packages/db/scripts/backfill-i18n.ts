/**
 * Task F1a, item 4: idempotent i18n backfill for badges, challenges,
 * locations and slider-config menu items.
 *
 * Unlike packages/db/prisma/seed-prod.ts (which creates rows by a fixed
 * id and is meant for a fresh or fully-managed database), this script only
 * *updates* rows that already exist, matched by their unique `slug`
 * (Badge, Challenge, Location) or by `category` (the slider MenuItem rows,
 * which have no slug column). It never creates or deletes a row.
 *
 * Task F1 adds two sections with the same rules: the badges and challenge
 * that one-off scripts added to prod (prisma/seed-data/legacy-badges.ts,
 * matched by slug), and menu names and descriptions in all four locales
 * (prisma/seed-data/menu-copy.ts, matched by English name). For menu rows
 * the only English ever written replaces a known catering-era description
 * (or an empty one); the per-locale columns are filled only when empty.
 *
 * Fix round 1 (review, Critical 2 + Important 1 + Important 3): the row's
 * own English columns (name, description, and for a slider MenuItem,
 * `sliderConfig.labels`) are the single source of truth for English, and
 * are NEVER written by this script. Before writing anything to a row, the
 * script checks that the row's current English (trimmed, case-insensitive)
 * matches the seed's `i18n.en` (or, for a slider, that `labels` matches
 * `labelsI18n.en`). A prod row whose text has drifted from the seed (an
 * admin rename, a re-purposed slider) is left completely untouched -- it is
 * reported as "mismatched" and logged, never overwritten -- since writing
 * `i18n` for text that no longer matches would make the seed's stale
 * English (baked into `i18n.en` as a side effect) leak back in everywhere
 * once combined with the localizers' fallback rules.
 *
 * `iconEmoji` is only ever cleared when `--clear-emoji` is passed. By
 * default this script only touches `iconKey`, `i18n` and (nested inside
 * `sliderConfig`) `labelsI18n` -- every other column, and every other key
 * already inside `sliderConfig`, is left exactly as it was. This matters
 * because prod's live UI still renders `badge.iconEmoji` /
 * `challenge.iconEmoji` directly (loyalty page, member dashboard) until
 * the new in-house seal UI ships; clearing the emoji before that ships
 * would blank every badge/challenge icon on the live site. The controller
 * runs `--clear-emoji` once, at cutover, after the seal UI deploys.
 *
 * Safe to run repeatedly: a second run makes no changes (every field it
 * would write already matches).
 *
 * Usage:
 *   tsx scripts/backfill-i18n.ts --dry-run                 # log planned changes, write nothing
 *   tsx scripts/backfill-i18n.ts                            # apply i18n/iconKey/labelsI18n
 *   tsx scripts/backfill-i18n.ts --clear-emoji --emoji-backup=<new file>   # also null out iconEmoji (post seal-UI cutover only);
 *                                                           # the backup (required) is written first, for emoji-backup.ts --from
 *   tsx scripts/backfill-i18n.ts --dry-run --clear-emoji    # preview both together
 *
 * Run against DATABASE_URL from the environment (e.g. via
 * `node --env-file=../../.env` or `dotenv`), same as every other script in
 * this package. Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1
 * (Task G3), and prints the target host/database first.
 */
import { PrismaClient } from "@prisma/client";
import { requireSafeTarget, targetBanner } from "./lib/db-guard.ts";
import { takeEmojiBackup } from "./emoji-backup.ts";
import { BADGES } from "../prisma/seed-data/badges";
import { CHALLENGES } from "../prisma/seed-data/challenges";
import { LOCATION_I18N } from "../prisma/seed-data/locations";
import { SLIDER_LABELS_I18N } from "../prisma/seed-data/slider-labels";
import { LEGACY_BADGES, LEGACY_CHALLENGES } from "../prisma/seed-data/legacy-badges";
import { MENU_COPY, type MenuLocale } from "../prisma/seed-data/menu-copy";

export interface BackfillSection {
  updated: string[];
  skipped: string[]; // already up to date
  missing: string[]; // no row with that slug/category exists -- never created
  mismatched: string[]; // row's own English text doesn't match the seed -- never overwritten
}

export interface BackfillResult {
  badges: BackfillSection;
  challenges: BackfillSection;
  locations: BackfillSection;
  menuItems: BackfillSection;
  /** Task F1: badges/challenge added by one-off scripts (prisma/seed-data/legacy-badges.ts). */
  legacy: BackfillSection;
  /** Task F1: menu names and descriptions (prisma/seed-data/menu-copy.ts). */
  menuCopy: BackfillSection;
}

export interface BackfillOptions {
  dryRun?: boolean;
  /** Off by default: see the module doc above for why. */
  clearEmoji?: boolean;
}

function emptySection(): BackfillSection {
  return { updated: [], skipped: [], missing: [], mismatched: [] };
}

/** Recursively sorts object keys so two structurally-equal values stringify
 * the same way regardless of key order. Needed because Postgres JSONB does
 * not preserve the key order it was written with, so a naive
 * `JSON.stringify(a) === JSON.stringify(b)` flags an already-up-to-date row
 * (round-tripped through the DB) as different from the in-memory literal
 * every single time. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function sameText(a: unknown, b: unknown): boolean {
  return typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function backfillI18n(prisma: PrismaClient, opts: BackfillOptions = {}): Promise<BackfillResult> {
  const dryRun = !!opts.dryRun;
  const clearEmoji = !!opts.clearEmoji;
  const prefix = dryRun ? "[dry-run] " : "";
  const result: BackfillResult = {
    badges: emptySection(),
    challenges: emptySection(),
    locations: emptySection(),
    menuItems: emptySection(),
    legacy: emptySection(),
    menuCopy: emptySection(),
  };

  // ---- Badges (match by slug) ----
  for (const b of BADGES) {
    const existing = await prisma.badge.findUnique({ where: { slug: b.slug } });
    if (!existing) {
      result.badges.missing.push(b.slug);
      continue;
    }
    if (!sameText(existing.name, b.i18n.en.name) || !sameText(existing.description, b.i18n.en.description)) {
      console.log(`SKIP badge ${b.slug}: prod text differs (name: "${existing.name}")`);
      result.badges.mismatched.push(b.slug);
      continue;
    }
    const emojiUpToDate = !clearEmoji || existing.iconEmoji === null;
    const upToDate = existing.iconKey === b.iconKey && sameJson(existing.i18n, b.i18n) && emojiUpToDate;
    if (upToDate) {
      result.badges.skipped.push(b.slug);
      continue;
    }
    const data: Record<string, unknown> = { iconKey: b.iconKey, i18n: b.i18n as any };
    if (clearEmoji) data.iconEmoji = null;
    console.log(`${prefix}badge "${b.slug}": set iconKey="${b.iconKey}", i18n${clearEmoji ? ", iconEmoji=null" : ""}`);
    if (!dryRun) {
      await prisma.badge.update({ where: { slug: b.slug }, data });
    }
    result.badges.updated.push(b.slug);
  }

  // ---- Challenges (match by slug; iconEmoji stays schema-required, so "" not null) ----
  for (const c of CHALLENGES) {
    const existing = await prisma.challenge.findUnique({ where: { slug: c.slug } });
    if (!existing) {
      result.challenges.missing.push(c.slug);
      continue;
    }
    if (!sameText(existing.name, c.i18n.en.name) || !sameText(existing.description, c.i18n.en.description)) {
      console.log(`SKIP challenge ${c.slug}: prod text differs (name: "${existing.name}")`);
      result.challenges.mismatched.push(c.slug);
      continue;
    }
    const emojiUpToDate = !clearEmoji || existing.iconEmoji === "";
    const upToDate = existing.iconKey === c.iconKey && sameJson(existing.i18n, c.i18n) && emojiUpToDate;
    if (upToDate) {
      result.challenges.skipped.push(c.slug);
      continue;
    }
    const data: Record<string, unknown> = { iconKey: c.iconKey, i18n: c.i18n as any };
    if (clearEmoji) data.iconEmoji = "";
    console.log(`${prefix}challenge "${c.slug}": set iconKey="${c.iconKey}", i18n${clearEmoji ? ', iconEmoji=""' : ""}`);
    if (!dryRun) {
      await prisma.challenge.update({ where: { slug: c.slug }, data });
    }
    result.challenges.updated.push(c.slug);
  }

  // ---- Locations (match by slug only -- see module doc; a location without
  // the expected slug is left alone rather than guessed at by name) ----
  for (const slug of Object.keys(LOCATION_I18N)) {
    const existing = await prisma.location.findUnique({ where: { slug } });
    if (!existing) {
      result.locations.missing.push(slug);
      continue;
    }
    const i18n = LOCATION_I18N[slug];
    if (!sameText(existing.name, i18n.en.name)) {
      console.log(`SKIP location ${slug}: prod text differs (name: "${existing.name}")`);
      result.locations.mismatched.push(slug);
      continue;
    }
    if (sameJson(existing.i18n, i18n)) {
      result.locations.skipped.push(slug);
      continue;
    }
    console.log(`${prefix}location "${slug}": set i18n`);
    if (!dryRun) {
      await prisma.location.update({ where: { slug }, data: { i18n: i18n as any } });
    }
    result.locations.updated.push(slug);
  }

  // ---- Slider MenuItems (match by category -- MenuItem has no slug column).
  // sliderConfig is read-modify-written so min/max/step/default/labels/
  // description survive untouched; only labelsI18n is added or replaced. ----
  for (const category of Object.keys(SLIDER_LABELS_I18N)) {
    const items = await prisma.menuItem.findMany({ where: { category, categoryType: "SLIDER" } });
    if (items.length === 0) {
      result.menuItems.missing.push(category);
      continue;
    }
    const labelsI18n = SLIDER_LABELS_I18N[category];
    for (const item of items) {
      const sliderConfig = (item.sliderConfig as Record<string, unknown> | null) ?? {};
      if (!sameJson(sliderConfig.labels, labelsI18n.en)) {
        console.log(`SKIP menuItem ${category} (${item.id}): prod text differs (labels: ${JSON.stringify(sliderConfig.labels)})`);
        result.menuItems.mismatched.push(`${category}:${item.id}`);
        continue;
      }
      if (sameJson(sliderConfig.labelsI18n, labelsI18n)) {
        result.menuItems.skipped.push(`${category}:${item.id}`);
        continue;
      }
      console.log(`${prefix}menu item "${item.name}" (${category}): set sliderConfig.labelsI18n`);
      if (!dryRun) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { sliderConfig: { ...sliderConfig, labelsI18n } as any },
        });
      }
      result.menuItems.updated.push(`${category}:${item.id}`);
    }
  }

  // ---- Task F1: badges and the challenge added by one-off scripts (match by
  // slug; same English rule as above; iconEmoji only with --clear-emoji) ----
  const legacyRows: Array<{ model: "badge" | "challenge"; seed: (typeof LEGACY_BADGES)[number] }> = [
    ...LEGACY_BADGES.map((seed) => ({ model: "badge" as const, seed })),
    ...LEGACY_CHALLENGES.map((seed) => ({ model: "challenge" as const, seed })),
  ];
  for (const { model, seed } of legacyRows) {
    const delegate = (model === "badge" ? prisma.badge : prisma.challenge) as any;
    const existing = await delegate.findUnique({ where: { slug: seed.slug } });
    if (!existing) {
      result.legacy.missing.push(seed.slug);
      continue;
    }
    if (!sameText(existing.name, seed.i18n.en.name) || !sameText(existing.description, seed.i18n.en.description)) {
      console.log(`SKIP ${model} ${seed.slug}: prod text differs (name: "${existing.name}")`);
      result.legacy.mismatched.push(seed.slug);
      continue;
    }
    const clearedEmoji = model === "badge" ? null : "";
    const emojiUpToDate = !clearEmoji || existing.iconEmoji === clearedEmoji;
    if (existing.iconKey === seed.iconKey && sameJson(existing.i18n, seed.i18n) && emojiUpToDate) {
      result.legacy.skipped.push(seed.slug);
      continue;
    }
    const data: Record<string, unknown> = { iconKey: seed.iconKey, i18n: seed.i18n as any };
    if (clearEmoji) data.iconEmoji = clearedEmoji;
    console.log(`${prefix}${model} "${seed.slug}": set iconKey="${seed.iconKey}", i18n${clearEmoji ? ", iconEmoji cleared" : ""}`);
    if (!dryRun) {
      await delegate.update({ where: { slug: seed.slug }, data });
    }
    result.legacy.updated.push(seed.slug);
  }

  // ---- Task F1: menu names and descriptions (match by English name). English
  // is only written to replace a known catering-era string or an empty one;
  // per-locale columns are only filled when empty. ----
  const NAME_COL: Record<MenuLocale, string> = { "zh-TW": "nameZhTW", "zh-CN": "nameZhCN", es: "nameEs" };
  const DESC_COL: Record<MenuLocale, string> = { "zh-TW": "descriptionZhTW", "zh-CN": "descriptionZhCN", es: "descriptionEs" };
  const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";
  for (const seed of MENU_COPY) {
    const rows = (await prisma.menuItem.findMany({ where: { name: seed.name } })) as any[];
    if (!rows.length) {
      result.menuCopy.missing.push(seed.name);
      continue;
    }
    for (const row of rows) {
      const key = `${seed.name}:${row.id}`;
      const data: Record<string, string> = {};
      if (seed.en && !sameText(row.description, seed.en)) {
        const stale = blank(row.description) || (seed.replacesEn ?? []).some((old) => sameText(row.description, old));
        if (!stale) {
          console.log(`SKIP menu item "${seed.name}" (${row.id}): description differs from the seed and is not a known catering-era text`);
          result.menuCopy.mismatched.push(key);
          continue;
        }
        data.description = seed.en;
      }
      for (const [loc, value] of Object.entries(seed.names ?? {}) as Array<[MenuLocale, string]>) {
        if (blank(row[NAME_COL[loc]])) data[NAME_COL[loc]] = value;
      }
      for (const [loc, value] of Object.entries(seed.descriptions ?? {}) as Array<[MenuLocale, string]>) {
        if (blank(row[DESC_COL[loc]])) data[DESC_COL[loc]] = value;
      }
      if (Object.keys(data).length === 0) {
        result.menuCopy.skipped.push(key);
        continue;
      }
      console.log(`${prefix}menu item "${seed.name}" (${row.id}): set ${Object.keys(data).join(", ")}`);
      if (!dryRun) {
        await prisma.menuItem.update({ where: { id: row.id }, data });
      }
      result.menuCopy.updated.push(key);
    }
  }

  return result;
}

function summarize(result: BackfillResult, dryRun: boolean): void {
  const label = dryRun ? "Would update" : "Updated";
  console.log(`\n${label}: ${result.badges.updated.length} badges, ${result.challenges.updated.length} challenges, ${result.locations.updated.length} locations, ${result.menuItems.updated.length} slider menu items, ${result.legacy.updated.length} script-added badges/challenges, ${result.menuCopy.updated.length} menu item copy rows`);
  console.log(`Already up to date: ${result.badges.skipped.length} badges, ${result.challenges.skipped.length} challenges, ${result.locations.skipped.length} locations, ${result.menuItems.skipped.length} slider menu items, ${result.legacy.skipped.length} script-added badges/challenges, ${result.menuCopy.skipped.length} menu item copy rows`);
  const mismatched = [...result.badges.mismatched, ...result.challenges.mismatched, ...result.locations.mismatched, ...result.menuItems.mismatched, ...result.legacy.mismatched, ...result.menuCopy.mismatched];
  if (mismatched.length) {
    console.log(`Skipped, prod text differs from the seed (see SKIP lines above, never overwritten): ${mismatched.join(", ")}`);
  }
  const missing = [...result.badges.missing, ...result.challenges.missing, ...result.locations.missing, ...result.menuItems.missing, ...result.legacy.missing, ...result.menuCopy.missing];
  if (missing.length) {
    console.log(`No matching row (never created, skipped): ${missing.join(", ")}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const clearEmoji = process.argv.includes("--clear-emoji");
  const backupFile = process.argv.find((a) => a.startsWith("--emoji-backup="))?.slice("--emoji-backup=".length);
  // Task G3 fix round 1: a real emoji clear always takes a backup first.
  if (clearEmoji && !dryRun && !backupFile) throw new Error("--clear-emoji needs --emoji-backup=<new file> (the restore source)");
  const target = requireSafeTarget("backfill-i18n");
  console.log(`${targetBanner("backfill-i18n", target, dryRun)}${clearEmoji ? " --clear-emoji" : ""}`);
  const prisma = new PrismaClient();
  try {
    if (clearEmoji && !dryRun && backupFile) {
      const backup = await takeEmojiBackup(prisma, backupFile);
      console.log(`[backfill-i18n] emoji backup written: ${backup.badges.length} badges, ${backup.challenges.length} challenges -> ${backupFile}`);
    }
    const result = await backfillI18n(prisma, { dryRun, clearEmoji });
    summarize(result, dryRun);
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = typeof process.argv[1] === "string" && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
