/**
 * Task F1a, item 4: packages/db/scripts/backfill-i18n.ts must be genuinely
 * idempotent -- a second run (or a first run against rows a full seed
 * already wrote the same content into) makes no writes.
 *
 * Uses a tiny fake Prisma (findUnique/findMany/update only, no real DB),
 * same style as seed-comb-seats.test.ts. Deliberately returns JSON columns
 * with keys in a *different order* than the seed-data module writes them:
 * Postgres JSONB does not preserve key order, so a naive
 * `JSON.stringify(a) === JSON.stringify(b)` equality check would treat an
 * already-up-to-date row (round-tripped through the DB) as needing an
 * update every time. This test catches exactly that regression.
 *
 * Run with: pnpm --filter @oh/db test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { backfillI18n } from "../backfill-i18n.ts";
import { BADGES } from "../../prisma/seed-data/badges.ts";
import { CHALLENGES } from "../../prisma/seed-data/challenges.ts";
import { LOCATION_I18N } from "../../prisma/seed-data/locations.ts";
import { SLIDER_LABELS_I18N } from "../../prisma/seed-data/slider-labels.ts";

/** Same value, keys in reverse order at every level -- simulates a Postgres
 * JSONB round trip, which does not preserve author-written key order. */
function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = reorderKeys(v);
    return out;
  }
  return value;
}

function fakePrisma() {
  const badges = new Map(
    BADGES.map((b) => [
      b.slug,
      { id: b.id, slug: b.slug, iconKey: b.iconKey, iconEmoji: null, i18n: reorderKeys(b.i18n) },
    ]),
  );
  const challenges = new Map(
    CHALLENGES.map((c) => [
      c.slug,
      { id: c.id, slug: c.slug, iconKey: c.iconKey, iconEmoji: "", i18n: reorderKeys(c.i18n) },
    ]),
  );
  const locations = new Map(
    Object.entries(LOCATION_I18N).map(([slug, i18n]) => [slug, { id: slug, slug, i18n: reorderKeys(i18n) }]),
  );
  const menuItems = Object.entries(SLIDER_LABELS_I18N).map(([category, labelsI18n], i) => ({
    id: `item-${i}`,
    name: category,
    category,
    categoryType: "SLIDER",
    sliderConfig: { min: 0, max: 3, labels: labelsI18n.en, labelsI18n: reorderKeys(labelsI18n) },
  }));

  const updateCalls: { model: string; args: unknown }[] = [];

  return {
    prisma: {
      badge: {
        findUnique: async ({ where }: any) => badges.get(where.slug) ?? null,
        update: async (args: any) => {
          updateCalls.push({ model: "badge", args });
          return args;
        },
      },
      challenge: {
        findUnique: async ({ where }: any) => challenges.get(where.slug) ?? null,
        update: async (args: any) => {
          updateCalls.push({ model: "challenge", args });
          return args;
        },
      },
      location: {
        findUnique: async ({ where }: any) => locations.get(where.slug) ?? null,
        update: async (args: any) => {
          updateCalls.push({ model: "location", args });
          return args;
        },
      },
      menuItem: {
        findMany: async ({ where }: any) => menuItems.filter((m) => m.category === where.category && m.categoryType === where.categoryType),
        update: async (args: any) => {
          updateCalls.push({ model: "menuItem", args });
          return args;
        },
      },
    } as any,
    updateCalls,
  };
}

describe("backfillI18n idempotency", () => {
  test("makes no writes when every row already matches (even with reordered JSON keys)", async () => {
    const { prisma, updateCalls } = fakePrisma();
    const result = await backfillI18n(prisma);

    assert.deepEqual(updateCalls, []);
    assert.equal(result.badges.updated.length, 0);
    assert.equal(result.badges.skipped.length, BADGES.length);
    assert.equal(result.challenges.updated.length, 0);
    assert.equal(result.challenges.skipped.length, CHALLENGES.length);
    assert.equal(result.locations.updated.length, 0);
    assert.equal(result.locations.skipped.length, Object.keys(LOCATION_I18N).length);
    assert.equal(result.menuItems.updated.length, 0);
    assert.equal(result.menuItems.skipped.length, Object.keys(SLIDER_LABELS_I18N).length);
  });

  test("updates only the rows that actually differ, and dry-run writes nothing", async () => {
    const { prisma, updateCalls } = fakePrisma();
    // Simulate one stale badge (old emoji, no i18n) among otherwise
    // up-to-date rows.
    (prisma as any).badge.findUnique = async ({ where }: any) => {
      if (where.slug === "vip") {
        return { id: "b-vip", slug: "vip", iconKey: null, iconEmoji: "\u{1F48E}", i18n: null };
      }
      const b = BADGES.find((x) => x.slug === where.slug)!;
      return { id: b.id, slug: b.slug, iconKey: b.iconKey, iconEmoji: null, i18n: reorderKeys(b.i18n) };
    };

    const dryRunResult = await backfillI18n(prisma, { dryRun: true });
    assert.deepEqual(updateCalls, [], "dry-run must not write");
    assert.deepEqual(dryRunResult.badges.updated, ["vip"]);

    const realResult = await backfillI18n(prisma, { dryRun: false });
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].model, "badge");
    assert.deepEqual(realResult.badges.updated, ["vip"]);
  });

  test("never creates a row for a slug/category that doesn't exist", async () => {
    const { prisma } = fakePrisma();
    (prisma as any).badge.findUnique = async () => null;
    (prisma as any).challenge.findUnique = async () => null;
    (prisma as any).location.findUnique = async () => null;
    (prisma as any).menuItem.findMany = async () => [];

    const result = await backfillI18n(prisma, { dryRun: true });
    assert.equal(result.badges.missing.length, BADGES.length);
    assert.equal(result.badges.updated.length, 0);
    assert.equal(result.challenges.missing.length, CHALLENGES.length);
    assert.equal(result.locations.missing.length, Object.keys(LOCATION_I18N).length);
    assert.equal(result.menuItems.missing.length, Object.keys(SLIDER_LABELS_I18N).length);
  });
});
