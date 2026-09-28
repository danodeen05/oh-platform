/**
 * Task F1a, item 4: idempotent i18n backfill for badges, challenges,
 * locations and slider-config menu items.
 *
 * Unlike packages/db/prisma/seed-prod.ts (which creates rows by a fixed
 * id and is meant for a fresh or fully-managed database), this script only
 * *updates* rows that already exist, matched by their unique `slug`
 * (Badge, Challenge, Location) or by `category` (the slider MenuItem rows,
 * which have no slug column). It never creates or deletes a row, and it
 * only ever touches `iconKey`, `i18n`, `iconEmoji` and (nested inside
 * `sliderConfig`) `labelsI18n` -- every other column, and every other key
 * already inside `sliderConfig`, is left exactly as it was.
 *
 * This is the tool for a database that already has these rows from an
 * older seed run (prod, or a dev database seeded before this task), where
 * dropping and recreating badges/challenges/locations is not an option.
 *
 * Safe to run repeatedly: a second run makes no changes (every field it
 * would write already matches).
 *
 * Usage:
 *   tsx scripts/backfill-i18n.ts --dry-run   # log planned changes, write nothing
 *   tsx scripts/backfill-i18n.ts             # apply
 *
 * Run against DATABASE_URL from the environment (e.g. via
 * `node --env-file=../../.env` or `dotenv`), same as every other script in
 * this package.
 */
import { PrismaClient } from "@prisma/client";
import { BADGES } from "../prisma/seed-data/badges";
import { CHALLENGES } from "../prisma/seed-data/challenges";
import { LOCATION_I18N } from "../prisma/seed-data/locations";
import { SLIDER_LABELS_I18N } from "../prisma/seed-data/slider-labels";

export interface BackfillSection {
  updated: string[];
  skipped: string[]; // already up to date
  missing: string[]; // no row with that slug/category exists -- never created
}

export interface BackfillResult {
  badges: BackfillSection;
  challenges: BackfillSection;
  locations: BackfillSection;
  menuItems: BackfillSection;
}

function emptySection(): BackfillSection {
  return { updated: [], skipped: [], missing: [] };
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

export async function backfillI18n(prisma: PrismaClient, opts: { dryRun?: boolean } = {}): Promise<BackfillResult> {
  const dryRun = !!opts.dryRun;
  const prefix = dryRun ? "[dry-run] " : "";
  const result: BackfillResult = {
    badges: emptySection(),
    challenges: emptySection(),
    locations: emptySection(),
    menuItems: emptySection(),
  };

  // ---- Badges (match by slug) ----
  for (const b of BADGES) {
    const existing = await prisma.badge.findUnique({ where: { slug: b.slug } });
    if (!existing) {
      result.badges.missing.push(b.slug);
      continue;
    }
    const upToDate =
      existing.iconKey === b.iconKey &&
      existing.iconEmoji === null &&
      sameJson(existing.i18n, b.i18n);
    if (upToDate) {
      result.badges.skipped.push(b.slug);
      continue;
    }
    console.log(`${prefix}badge "${b.slug}": set iconKey="${b.iconKey}", i18n, iconEmoji=null`);
    if (!dryRun) {
      await prisma.badge.update({
        where: { slug: b.slug },
        data: { iconKey: b.iconKey, i18n: b.i18n as any, iconEmoji: null },
      });
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
    const upToDate =
      existing.iconKey === c.iconKey &&
      existing.iconEmoji === "" &&
      sameJson(existing.i18n, c.i18n);
    if (upToDate) {
      result.challenges.skipped.push(c.slug);
      continue;
    }
    console.log(`${prefix}challenge "${c.slug}": set iconKey="${c.iconKey}", i18n, iconEmoji=""`);
    if (!dryRun) {
      await prisma.challenge.update({
        where: { slug: c.slug },
        data: { iconKey: c.iconKey, i18n: c.i18n as any, iconEmoji: "" },
      });
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

  return result;
}

function summarize(result: BackfillResult, dryRun: boolean): void {
  const label = dryRun ? "Would update" : "Updated";
  console.log(`\n${label}: ${result.badges.updated.length} badges, ${result.challenges.updated.length} challenges, ${result.locations.updated.length} locations, ${result.menuItems.updated.length} slider menu items`);
  console.log(`Already up to date: ${result.badges.skipped.length} badges, ${result.challenges.skipped.length} challenges, ${result.locations.skipped.length} locations, ${result.menuItems.skipped.length} slider menu items`);
  const missing = [...result.badges.missing, ...result.challenges.missing, ...result.locations.missing, ...result.menuItems.missing];
  if (missing.length) {
    console.log(`No matching row (never created, skipped): ${missing.join(", ")}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  try {
    const result = await backfillI18n(prisma, { dryRun });
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
