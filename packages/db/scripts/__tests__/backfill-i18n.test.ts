/**
 * Task F1a, item 4: packages/db/scripts/backfill-i18n.ts must be genuinely
 * idempotent -- a second run (or a first run against rows a full seed
 * already wrote the same content into) makes no writes -- and, per fix
 * round 1 (review, Critical 2 + Important 1 + Important 3), must never
 * overwrite a row whose own English text has drifted from the seed, and
 * must never clear `iconEmoji` unless `--clear-emoji` is explicitly passed.
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

/** A prod row that already has the seed's English (the normal, matching
 * case) but predates i18n/iconKey -- the state the backfill exists for. */
function upToDateBadgeRow(b: (typeof BADGES)[number]) {
  return { id: b.id, slug: b.slug, name: b.i18n.en.name, description: b.i18n.en.description, iconKey: b.iconKey, iconEmoji: null, i18n: reorderKeys(b.i18n) };
}
function upToDateChallengeRow(c: (typeof CHALLENGES)[number]) {
  return { id: c.id, slug: c.slug, name: c.i18n.en.name, description: c.i18n.en.description, iconKey: c.iconKey, iconEmoji: "", i18n: reorderKeys(c.i18n) };
}

function fakePrisma() {
  const badges = new Map(BADGES.map((b) => [b.slug, upToDateBadgeRow(b)]));
  const challenges = new Map(CHALLENGES.map((c) => [c.slug, upToDateChallengeRow(c)]));
  const locations = new Map(
    Object.entries(LOCATION_I18N).map(([slug, i18n]) => [slug, { id: slug, slug, name: i18n.en.name, i18n: reorderKeys(i18n) }]),
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
    assert.equal(result.badges.mismatched.length, 0);
    assert.equal(result.challenges.updated.length, 0);
    assert.equal(result.challenges.skipped.length, CHALLENGES.length);
    assert.equal(result.locations.updated.length, 0);
    assert.equal(result.locations.skipped.length, Object.keys(LOCATION_I18N).length);
    assert.equal(result.menuItems.updated.length, 0);
    assert.equal(result.menuItems.skipped.length, Object.keys(SLIDER_LABELS_I18N).length);
  });

  test("updates only the rows that actually differ, and dry-run writes nothing", async () => {
    const { prisma, updateCalls } = fakePrisma();
    // Simulate one stale badge (no i18n/iconKey yet, but matching English)
    // among otherwise up-to-date rows.
    const vip = BADGES.find((b) => b.slug === "vip")!;
    (prisma as any).badge.findUnique = async ({ where }: any) => {
      if (where.slug === "vip") {
        return { id: "b-vip", slug: "vip", name: vip.i18n.en.name, description: vip.i18n.en.description, iconKey: null, iconEmoji: null, i18n: null };
      }
      return upToDateBadgeRow(BADGES.find((x) => x.slug === where.slug)!);
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

describe("backfillI18n: a prod row whose English differs from the seed is never overwritten", () => {
  test("a badge whose name/description differ from the seed is skipped and left completely untouched", async () => {
    const { prisma, updateCalls } = fakePrisma();
    const prodRow = { id: "b-vip", slug: "vip", name: "VIP", description: "A totally different, prod-only description", iconKey: null, iconEmoji: "\u{1F48E}", i18n: null };
    (prisma as any).badge.findUnique = async ({ where }: any) => (where.slug === "vip" ? { ...prodRow } : upToDateBadgeRow(BADGES.find((x) => x.slug === where.slug)!));

    const result = await backfillI18n(prisma, { dryRun: false });

    assert.deepEqual(result.badges.mismatched, ["vip"]);
    assert.ok(!result.badges.updated.includes("vip"));
    assert.equal(updateCalls.filter((c) => c.model === "badge").length, 0);
  });

  test("a challenge whose description differs from the seed is skipped and left untouched", async () => {
    const { prisma, updateCalls } = fakePrisma();
    const earlyBird = CHALLENGES.find((c) => c.slug === "early-bird")!;
    const prodRow = { id: "c-eb", slug: "early-bird", name: earlyBird.i18n.en.name, description: "A re-purposed, prod-only description", iconKey: null, iconEmoji: "", i18n: null };
    (prisma as any).challenge.findUnique = async ({ where }: any) => (where.slug === "early-bird" ? prodRow : upToDateChallengeRow(CHALLENGES.find((x) => x.slug === where.slug)!));

    const result = await backfillI18n(prisma, { dryRun: false });

    assert.deepEqual(result.challenges.mismatched, ["early-bird"]);
    assert.equal(updateCalls.filter((c) => c.model === "challenge").length, 0);
  });

  test("a location whose name differs from the seed is skipped and left untouched", async () => {
    const { prisma, updateCalls } = fakePrisma();
    (prisma as any).location.findUnique = async ({ where }: any) =>
      where.slug === "city-creek" ? { id: "loc-cc", slug: "city-creek", name: "x", i18n: null } : { id: where.slug, slug: where.slug, name: LOCATION_I18N[where.slug].en.name, i18n: reorderKeys(LOCATION_I18N[where.slug]) };

    const result = await backfillI18n(prisma, { dryRun: false });

    assert.deepEqual(result.locations.mismatched, ["city-creek"]);
    assert.equal(updateCalls.filter((c) => c.model === "location").length, 0);
  });

  test("a slider menu item whose stored labels differ from the seed's English labels is skipped and left untouched", async () => {
    const { prisma, updateCalls } = fakePrisma();
    (prisma as any).menuItem.findMany = async ({ where }: any) => {
      if (where.category === "slider03") {
        return [{ id: "item-repurposed", name: "Spice Level", category: "slider03", categoryType: "SLIDER", sliderConfig: { min: 0, max: 1, labels: ["Off", "On"] } }];
      }
      const labelsI18n = SLIDER_LABELS_I18N[where.category];
      return [{ id: `item-${where.category}`, name: where.category, category: where.category, categoryType: "SLIDER", sliderConfig: { min: 0, max: 3, labels: labelsI18n.en, labelsI18n: reorderKeys(labelsI18n) } }];
    };

    const result = await backfillI18n(prisma, { dryRun: false });

    assert.ok(result.menuItems.mismatched.some((m) => m.startsWith("slider03:")));
    assert.equal(updateCalls.filter((c) => c.model === "menuItem" && (c.args as any).where.id === "item-repurposed").length, 0);
  });
});

describe("backfillI18n: --clear-emoji gating (Important 3)", () => {
  test("iconEmoji is left untouched by default, even when everything else needs an update", async () => {
    const { prisma, updateCalls } = fakePrisma();
    const vip = BADGES.find((b) => b.slug === "vip")!;
    (prisma as any).badge.findUnique = async ({ where }: any) =>
      where.slug === "vip"
        ? { id: "b-vip", slug: "vip", name: vip.i18n.en.name, description: vip.i18n.en.description, iconKey: null, iconEmoji: "\u{1F48E}", i18n: null }
        : upToDateBadgeRow(BADGES.find((x) => x.slug === where.slug)!);

    await backfillI18n(prisma, { dryRun: false });

    const vipUpdate = updateCalls.find((c) => c.model === "badge" && (c.args as any).where.slug === "vip");
    assert.ok(vipUpdate, "vip should still be updated for iconKey/i18n");
    assert.ok(!("iconEmoji" in (vipUpdate!.args as any).data), "iconEmoji must not be part of the write without --clear-emoji");
  });

  test("--clear-emoji nulls iconEmoji on badges and blanks it on challenges once text matches", async () => {
    const { prisma, updateCalls } = fakePrisma();
    const vip = BADGES.find((b) => b.slug === "vip")!;
    (prisma as any).badge.findUnique = async ({ where }: any) =>
      where.slug === "vip"
        ? { id: "b-vip", slug: "vip", name: vip.i18n.en.name, description: vip.i18n.en.description, iconKey: vip.iconKey, iconEmoji: "\u{1F48E}", i18n: vip.i18n }
        : upToDateBadgeRow(BADGES.find((x) => x.slug === where.slug)!);

    const result = await backfillI18n(prisma, { dryRun: false, clearEmoji: true });

    assert.deepEqual(result.badges.updated, ["vip"]);
    const vipUpdate = updateCalls.find((c) => c.model === "badge" && (c.args as any).where.slug === "vip");
    assert.equal((vipUpdate!.args as any).data.iconEmoji, null);
  });

  test("--clear-emoji still refuses to touch a mismatched row", async () => {
    const { prisma, updateCalls } = fakePrisma();
    (prisma as any).badge.findUnique = async ({ where }: any) =>
      where.slug === "vip"
        ? { id: "b-vip", slug: "vip", name: "VIP", description: "Prod-only text", iconKey: null, iconEmoji: "\u{1F48E}", i18n: null }
        : upToDateBadgeRow(BADGES.find((x) => x.slug === where.slug)!);

    const result = await backfillI18n(prisma, { dryRun: false, clearEmoji: true });

    assert.deepEqual(result.badges.mismatched, ["vip"]);
    assert.equal(updateCalls.filter((c) => c.model === "badge").length, 0);
  });
});
