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
 * run against the same location creates nothing new.
 *
 * Run directly (`pnpm --filter @oh/db exec tsx scripts/seed-comb-seats.ts
 * --all`, or `pnpm --filter @oh/db run seed:comb-seats`) to seed both real
 * locations by their known ids. `seed-prod.ts` imports `seedCombSeats` and
 * `LOCATIONS` directly instead of shelling out.
 */
import { PrismaClient } from "@prisma/client";
import { buildLayout, LOCATION_LAYOUTS, podLabel, rankPodsByEntry, type Pod } from "@oh/floor-plan";

export type LayoutKey = keyof typeof LOCATION_LAYOUTS;

export interface SeedCombSeatsArgs {
  locationId: string;
  layoutKey: LayoutKey;
  now?: Date;
}

export interface SeedCombSeatsResult {
  created: number;
  retired: number;
}

/** The two real comb locations (site overhaul spec 6.2 / A8 controller note 4). */
export const LOCATIONS: readonly { id: string; slug: string; layoutKey: LayoutKey }[] = [
  { id: "cmip6jbz700022nnnxxpmm5hf", slug: "city-creek", layoutKey: "comb-75" },
  { id: "cmip6jbza00042nnnf4nc0dvh", slug: "university-place", layoutKey: "comb-70-mirrored" },
];

function podType(pod: Pod): "SINGLE" | "DUAL" {
  return pod.type === "duo" ? "DUAL" : "SINGLE";
}

/**
 * Seeds (or re-seeds) the comb seats for one location. Idempotent: safe to
 * run repeatedly, including after a pod count/layout change (it retires
 * whatever no longer belongs and never touches other locations).
 */
export async function seedCombSeats(prisma: Pick<PrismaClient, "seat">, { locationId, layoutKey, now = new Date() }: SeedCombSeatsArgs): Promise<SeedCombSeatsResult> {
  const options = LOCATION_LAYOUTS[layoutKey];
  if (!options) throw new Error(`seedCombSeats: unknown layoutKey "${String(layoutKey)}"`);
  const layout = buildLayout(options);
  const ranks = rankPodsByEntry(layout);

  const idByLabel = new Map<string, string>();
  const labels = new Set<string>();
  let created = 0;

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
    const existing = await prisma.seat.findFirst({ where: { locationId, number: label } });
    if (existing) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.seat.update({ where: { id: existing.id }, data: fields });
      idByLabel.set(label, existing.id);
    } else {
      // eslint-disable-next-line no-await-in-loop
      const seat = await prisma.seat.create({
        data: { locationId, number: label, status: "AVAILABLE", ...fields },
      });
      idByLabel.set(label, seat.id);
      created += 1;
    }
  }

  for (const [numA, numB] of layout.duoPairs) {
    const podA = layout.pods.find((p) => p.number === numA);
    const podB = layout.pods.find((p) => p.number === numB);
    if (!podA || !podB) continue; // trimmed out of this pod count
    const idA = idByLabel.get(podLabel(podA));
    const idB = idByLabel.get(podLabel(podB));
    if (!idA || !idB) continue;
    // eslint-disable-next-line no-await-in-loop
    await prisma.seat.update({ where: { id: idA }, data: { dualPartnerId: idB } });
    // eslint-disable-next-line no-await-in-loop
    await prisma.seat.update({ where: { id: idB }, data: { dualPartnerId: idA } });
  }

  const retireResult = await prisma.seat.updateMany({
    where: { locationId, retiredAt: null, number: { notIn: [...labels] } },
    data: { retiredAt: now },
  });

  return { created, retired: retireResult.count };
}

/**
 * Sets the location's layout fields (slug/layoutKey/layoutMirror/podCount),
 * seeds its comb seats, and keeps `LocationStats.totalSeats` in sync with
 * `podCount`. Exported so `seed-prod.ts` can call it directly instead of
 * shelling out to this script.
 */
export async function seedLocation(prisma: PrismaClient, entry: (typeof LOCATIONS)[number]) {
  const options = LOCATION_LAYOUTS[entry.layoutKey];
  await prisma.location.update({
    where: { id: entry.id },
    data: { slug: entry.slug, layoutKey: entry.layoutKey, layoutMirror: options.mirror, podCount: options.pods },
  });
  const result = await seedCombSeats(prisma, { locationId: entry.id, layoutKey: entry.layoutKey });
  await prisma.locationStats.upsert({
    where: { locationId: entry.id },
    update: { totalSeats: options.pods },
    create: { locationId: entry.id, totalSeats: options.pods, availableSeats: options.pods, occupiedSeats: 0, avgWaitMinutes: 0 },
  });
  console.log(`[seed-comb-seats] ${entry.slug} (${entry.layoutKey}): created ${result.created}, retired ${result.retired}`);
  return result;
}

async function main() {
  if (!process.argv.includes("--all")) {
    console.log("Usage: tsx scripts/seed-comb-seats.ts --all");
    return;
  }
  const prisma = new PrismaClient();
  try {
    for (const entry of LOCATIONS) {
      // eslint-disable-next-line no-await-in-loop -- locations seed sequentially for clear, ordered log output
      await seedLocation(prisma, entry);
    }
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
