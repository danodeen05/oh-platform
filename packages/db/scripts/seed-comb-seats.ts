/**
 * Task A8: comb seats for City Creek (75 pods, unmirrored) and University
 * Place (70 pods, mirrored).
 *
 * This is a plain TypeScript script, run with `tsx` (never imported by the
 * API, which is plain Node ESM and only reads the `Seat` fields this script
 * writes - see the api/src/seats/service.js comment). It uses
 * `@oh/floor-plan`'s `buildLayout`/`LOCATION_LAYOUTS`/`podLabel` for the
 * geometry and `rankPodsByEntry` for "best pod" (spec 6.2: the free pod
 * nearest the entry).
 *
 * `seedCombSeats` is the reusable, idempotent core: given a location id and
 * a layout key, it upserts one `Seat` row per pod (keyed on
 * `(locationId, number = label)`), links duo partners bidirectionally, and
 * retires (`retiredAt`) any seat at that location whose number isn't one of
 * the layout's labels (e.g. the old 12-pod `"01".."12"` numbering). A second
 * run against the same location creates, updates and links nothing.
 *
 * Run directly (`pnpm --filter @oh/db exec tsx scripts/seed-comb-seats.ts
 * --all`, or `pnpm --filter @oh/db run seed:comb-seats`) to seed both real
 * locations. `seed-prod.ts` imports `seedLocation` and `LOCATIONS` directly
 * instead of shelling out.
 *
 * Task G3 (cutover) additions:
 *  - `--dry-run`: reports what a real run would create, update, retire and
 *    link, and writes nothing.
 *  - Locations resolve by SLUG first (`city-creek`, `university-place`).
 *    Only when no row carries the slug yet does it fall back to the known
 *    id, or to `--location-id=<slug>=<id>` when prod's live row has another
 *    id. A closed row (`isClosed`) is refused either way: prod keeps closed
 *    duplicates of both locations, and seats must land on the LIVE rows.
 *    Every location resolves before anything is written.
 *  - Seats retired by a run get that run's exact `retiredAt` (printed), so a
 *    rollback can clear just those.
 *  - `--release-closed-slugs`: a closed duplicate holding one of the slugs
 *    gives it up first (fix round 1); live rows are never touched by it.
 *  - Not one transaction: each pod is its own write. A crashed run is safe to
 *    re-run (it converges); use seat-rollback-release1 to go back.
 *  - Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { PrismaClient } from "@prisma/client";
import { buildLayout, LOCATION_LAYOUTS, podLabel, rankPodsByEntry, type Pod } from "@oh/floor-plan";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";

export type LayoutKey = keyof typeof LOCATION_LAYOUTS;

export interface SeedCombSeatsArgs {
  locationId: string;
  layoutKey: LayoutKey;
  now?: Date;
  /** Count only; write nothing (Task G3). */
  dryRun?: boolean;
}

export interface SeedCombSeatsResult {
  created: number;
  /** Existing seats whose layout fields changed (0 on a re-run). */
  updated: number;
  retired: number;
  /** Duo partner links written (or, in a dry run, that would be). */
  duoLinks: number;
}

/** The two real comb locations (site overhaul spec 6.2 / A8 controller note 4). */
export const LOCATIONS: readonly { id: string; slug: string; layoutKey: LayoutKey }[] = [
  { id: "cmip6jbz700022nnnxxpmm5hf", slug: "city-creek", layoutKey: "comb-75" },
  { id: "cmip6jbza00042nnnf4nc0dvh", slug: "university-place", layoutKey: "comb-70-mirrored" },
];

export type LocationEntry = (typeof LOCATIONS)[number];

const SEAT_FIELDS = ["finger", "rowSide", "position", "label", "podType", "bestRank", "qrCode", "retiredAt"] as const;

function sameValue(a: unknown, b: unknown): boolean {
  const av = a instanceof Date ? a.getTime() : (a ?? null);
  const bv = b instanceof Date ? b.getTime() : (b ?? null);
  return av === bv;
}

function podType(pod: Pod): "SINGLE" | "DUAL" {
  return pod.type === "duo" ? "DUAL" : "SINGLE";
}

/**
 * Seeds (or re-seeds) the comb seats for one location. Idempotent: safe to
 * run repeatedly, including after a pod count/layout change (it retires
 * whatever no longer belongs and never touches other locations). Only rows
 * whose fields actually differ are written.
 */
export async function seedCombSeats(prisma: Pick<PrismaClient, "seat">, { locationId, layoutKey, now = new Date(), dryRun = false }: SeedCombSeatsArgs): Promise<SeedCombSeatsResult> {
  const options = LOCATION_LAYOUTS[layoutKey];
  if (!options) throw new Error(`seedCombSeats: unknown layoutKey "${String(layoutKey)}"`);
  const layout = buildLayout(options);
  const ranks = rankPodsByEntry(layout);

  const idByLabel = new Map<string, string>();
  const partnerByLabel = new Map<string, string | null>();
  const labels = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const pod of layout.pods) {
    const label = podLabel(pod);
    labels.add(label);
    const qrCode = `POD-${locationId.slice(-8)}-${label}`;
    const bestRank = ranks.get(pod.number) ?? null;
    const fields = {
      finger: pod.finger,
      rowSide: pod.side,
      position: pod.position,
      label,
      podType: podType(pod),
      bestRank,
      qrCode,
      retiredAt: null,
    };

    // eslint-disable-next-line no-await-in-loop -- pods must be upserted one at a time (each needs its own id for the duo-linking pass below)
    const existing: any = await prisma.seat.findFirst({ where: { locationId, number: label } });
    if (existing) {
      idByLabel.set(label, existing.id);
      partnerByLabel.set(label, existing.dualPartnerId ?? null);
      if (SEAT_FIELDS.some((f) => !sameValue(existing[f], fields[f]))) {
        updated += 1;
        // A retired pod coming back (e.g. after seat-rollback-release1 set it
        // CLEANING) returns as AVAILABLE: nothing can be on a retired pod.
        const data = existing.retiredAt ? { ...fields, status: "AVAILABLE" as const } : fields;
        // eslint-disable-next-line no-await-in-loop
        if (!dryRun) await prisma.seat.update({ where: { id: existing.id }, data });
      }
    } else {
      created += 1;
      partnerByLabel.set(label, null);
      if (dryRun) {
        idByLabel.set(label, `(new:${label})`);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const seat = await prisma.seat.create({
          data: { locationId, number: label, status: "AVAILABLE", ...fields },
        });
        idByLabel.set(label, seat.id);
      }
    }
  }

  let duoLinks = 0;
  for (const [numA, numB] of layout.duoPairs) {
    const podA = layout.pods.find((p) => p.number === numA);
    const podB = layout.pods.find((p) => p.number === numB);
    if (!podA || !podB) continue; // trimmed out of this pod count
    const labelA = podLabel(podA);
    const labelB = podLabel(podB);
    const idA = idByLabel.get(labelA);
    const idB = idByLabel.get(labelB);
    if (!idA || !idB) continue;
    if (partnerByLabel.get(labelA) !== idB) {
      duoLinks += 1;
      // eslint-disable-next-line no-await-in-loop
      if (!dryRun) await prisma.seat.update({ where: { id: idA }, data: { dualPartnerId: idB } });
    }
    if (partnerByLabel.get(labelB) !== idA) {
      duoLinks += 1;
      // eslint-disable-next-line no-await-in-loop
      if (!dryRun) await prisma.seat.update({ where: { id: idB }, data: { dualPartnerId: idA } });
    }
  }

  const retireWhere = { locationId, retiredAt: null, number: { notIn: [...labels] } };
  const toRetire = await prisma.seat.count({ where: retireWhere });
  const retired = dryRun || toRetire === 0 ? toRetire : (await prisma.seat.updateMany({ where: retireWhere, data: { retiredAt: now } })).count;

  return { created, updated, retired, duoLinks };
}

/**
 * Finds the LIVE location row for an entry (Task G3): by slug first; if no
 * row has the slug yet, by `overrideId` or the entry's known id. Throws on a
 * closed row, a missing row, or an override that disagrees with the row
 * already holding the slug. Never matches by name.
 */
export async function resolveLocation(prisma: Pick<PrismaClient, "location">, entry: LocationEntry, overrideId?: string, releasedIds: ReadonlySet<string> = new Set()) {
  // A closed row whose slug a dry run of --release-closed-slugs would release counts as not holding it.
  const found: any = await prisma.location.findUnique({ where: { slug: entry.slug } });
  const bySlug = found && !releasedIds.has(found.id) ? found : null;
  if (bySlug) {
    if (overrideId && overrideId !== bySlug.id) {
      throw new Error(`${entry.slug}: --location-id says ${overrideId}, but row ${bySlug.id} already has this slug. Fix the slug by hand first.`);
    }
    if (bySlug.isClosed) throw new Error(`${entry.slug}: the row holding this slug (${bySlug.id}) is closed. Move the slug to the live row first.`);
    return { location: bySlug, via: "slug" as const };
  }
  const id = overrideId ?? entry.id;
  const byId: any = await prisma.location.findUnique({ where: { id } });
  if (!byId) throw new Error(`${entry.slug}: no row has this slug and no location has id ${id}. Pass --location-id=${entry.slug}=<live row id>.`);
  if (byId.isClosed) throw new Error(`${entry.slug}: location ${id} is closed. Pass --location-id=${entry.slug}=<live row id>.`);
  return { location: byId, via: overrideId ? ("override" as const) : ("known-id" as const) };
}

/**
 * Sets the location's layout fields (slug/layoutKey/layoutMirror/podCount),
 * seeds its comb seats, and keeps `LocationStats.totalSeats` in sync with
 * `podCount`. Exported so `seed-prod.ts` can call it directly instead of
 * shelling out to this script. With `dryRun`, it only reports.
 */
export async function seedLocation(
  prisma: PrismaClient,
  entry: LocationEntry,
  { dryRun = false, overrideId, now = new Date(), releasedIds = new Set<string>() }: { dryRun?: boolean; overrideId?: string; now?: Date; releasedIds?: ReadonlySet<string> } = {},
) {
  const options = LOCATION_LAYOUTS[entry.layoutKey];
  const { location, via } = await resolveLocation(prisma, entry, overrideId, releasedIds);
  const locationData = { slug: entry.slug, layoutKey: entry.layoutKey, layoutMirror: options.mirror, podCount: options.pods };
  const locationChanges = (Object.keys(locationData) as (keyof typeof locationData)[]).filter((k) => !sameValue(location[k], locationData[k]));
  if (!dryRun && locationChanges.length) {
    await prisma.location.update({ where: { id: location.id }, data: locationData });
  }
  const result = await seedCombSeats(prisma, { locationId: location.id, layoutKey: entry.layoutKey, dryRun, now });
  if (!dryRun) {
    await prisma.locationStats.upsert({
      where: { locationId: location.id },
      update: { totalSeats: options.pods },
      create: { locationId: location.id, totalSeats: options.pods, availableSeats: options.pods, occupiedSeats: 0, avgWaitMinutes: 0 },
    });
  }
  console.log(
    `[seed-comb-seats]${dryRun ? " [dry run]" : ""} ${entry.slug} (${entry.layoutKey}) location ${location.id} via ${via}: ` +
      `location fields ${locationChanges.length ? `${dryRun ? "to change" : "changed"} [${locationChanges.join(", ")}]` : "unchanged"}, ` +
      `created ${result.created}, updated ${result.updated}, retired ${result.retired}` +
      `${result.retired && !dryRun ? ` (retiredAt ${now.toISOString()})` : ""}, duo links ${result.duoLinks}`,
  );
  return result;
}

/**
 * `--release-closed-slugs` (Task G3 fix round 1): when a CLOSED duplicate row
 * holds `city-creek` / `university-place`, clear that slug (only on the closed
 * row, never on a live one) so the live row can take it. Returns the ids
 * released (or, in a dry run, that would be).
 */
export async function releaseClosedSlugs(prisma: Pick<PrismaClient, "location">, { dryRun }: { dryRun: boolean }): Promise<string[]> {
  const released: string[] = [];
  for (const entry of LOCATIONS) {
    // eslint-disable-next-line no-await-in-loop
    const row: any = await prisma.location.findUnique({ where: { slug: entry.slug } });
    if (!row || !row.isClosed) continue;
    released.push(row.id);
    // eslint-disable-next-line no-await-in-loop
    if (!dryRun) await prisma.location.updateMany({ where: { id: row.id, isClosed: true, slug: entry.slug }, data: { slug: null } });
  }
  return released;
}

/** Parses repeatable `--location-id=<slug>=<id>` flags. */
export function parseLocationOverrides(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--location-id=")) continue;
    const [slug, id, extra] = arg.slice("--location-id=".length).split("=");
    if (!slug || !id || extra !== undefined) throw new Error(`bad flag ${arg}; expected --location-id=<slug>=<id>`);
    if (!LOCATIONS.some((l) => l.slug === slug)) throw new Error(`unknown slug in ${arg}`);
    out.set(slug, id);
  }
  return out;
}

async function main() {
  if (!process.argv.includes("--all")) {
    console.log("Usage: tsx scripts/seed-comb-seats.ts --all [--dry-run] [--release-closed-slugs] [--location-id=<slug>=<id>]");
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const overrides = parseLocationOverrides(process.argv);
  const target = requireSafeTarget("seed-comb-seats");
  console.log(targetBanner("seed-comb-seats", target, dryRun));
  const prisma = new PrismaClient();
  const now = new Date();
  try {
    let releasedIds = new Set<string>();
    if (process.argv.includes("--release-closed-slugs")) {
      const released = await releaseClosedSlugs(prisma, { dryRun });
      releasedIds = new Set(dryRun ? released : []);
      console.log(`[seed-comb-seats]${dryRun ? " [dry run]" : ""} closed rows ${dryRun ? "that would release" : "released"} their slug: ${released.length ? released.join(", ") : "none"}`);
    }
    // Resolve every location before writing anything, so a bad mapping fails with no partial run.
    for (const entry of LOCATIONS) {
      // eslint-disable-next-line no-await-in-loop
      await resolveLocation(prisma, entry, overrides.get(entry.slug), releasedIds);
    }
    for (const entry of LOCATIONS) {
      // eslint-disable-next-line no-await-in-loop -- locations seed sequentially for clear, ordered log output
      await seedLocation(prisma, entry, { dryRun, overrideId: overrides.get(entry.slug), now, releasedIds });
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[seed-comb-seats] failed: ${err?.message ?? err}`);
    process.exitCode = 1;
  });
}
