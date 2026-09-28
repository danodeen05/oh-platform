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
import { LEGACY_BADGES, LEGACY_CHALLENGES } from "../../prisma/seed-data/legacy-badges.ts";
import { MENU_COPY } from "../../prisma/seed-data/menu-copy.ts";

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
// Task F1: a slug the seed doesn't know (the script-added legacy badges) has no row in these fakes.
function upToDateBadgeRow(b: (typeof BADGES)[number] | undefined) {
  if (!b) return null;
  return { id: b.id, slug: b.slug, name: b.i18n.en.name, description: b.i18n.en.description, iconKey: b.iconKey, iconEmoji: null, i18n: reorderKeys(b.i18n) };
}
function upToDateChallengeRow(c: (typeof CHALLENGES)[number] | undefined) {
  if (!c) return null;
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
      if (!labelsI18n) return []; // Task F1's menu-copy lookup (by name) finds nothing here.
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

// ---------------------------------------------------------------------------
// Task F1: script-added badges/challenge and menu copy.
// ---------------------------------------------------------------------------

/** A fake with only the F1 rows, so each test states exactly what the DB holds. */
function f1Prisma(opts: { badges?: any[]; challenges?: any[]; menu?: any[] }) {
  const updateCalls: { model: string; args: any }[] = [];
  const bySlug = (rows: any[] = []) => async ({ where }: any) => rows.find((r) => r.slug === where.slug) ?? null;
  const record = (model: string) => async (args: any) => {
    updateCalls.push({ model, args });
    return args;
  };
  return {
    updateCalls,
    prisma: {
      badge: { findUnique: bySlug(opts.badges), update: record("badge") },
      challenge: { findUnique: bySlug(opts.challenges), update: record("challenge") },
      location: { findUnique: async () => null, update: record("location") },
      menuItem: {
        findMany: async ({ where }: any) => {
          // The slider section queries by category; the F1 menu section by name.
          if (where.name === undefined) return [];
          return (opts.menu ?? []).filter((m) => m.name === where.name);
        },
        update: record("menuItem"),
      },
    } as any,
  };
}

const classic = MENU_COPY.find((m) => m.name === "Classic Beef Noodle Soup")!;
const thinFlat = MENU_COPY.find((m) => m.name === "Thin/Flat Noodles")!;

describe("backfillI18n (F1): script-added badges and challenge", () => {
  test("sets iconKey and i18n when the English matches, and a second run changes nothing", async () => {
    const lunch = LEGACY_BADGES.find((b) => b.slug === "lunch-regular")!;
    const meal = LEGACY_CHALLENGES[0];
    const badge = { id: "b1", slug: lunch.slug, name: lunch.i18n.en.name, description: lunch.i18n.en.description, iconKey: null as string | null, iconEmoji: "x", i18n: null as unknown };
    const challenge = { id: "c1", slug: meal.slug, name: meal.i18n.en.name, description: meal.i18n.en.description, iconKey: null as string | null, iconEmoji: "x", i18n: null as unknown };
    const { prisma, updateCalls } = f1Prisma({ badges: [badge], challenges: [challenge] });

    const first = await backfillI18n(prisma);
    assert.deepEqual(first.legacy.updated.sort(), ["lunch-regular", "meal-for-stranger"]);
    assert.ok(updateCalls.every((c) => !("iconEmoji" in c.args.data)), "iconEmoji untouched without --clear-emoji");

    Object.assign(badge, { iconKey: lunch.iconKey, i18n: reorderKeys(lunch.i18n) });
    Object.assign(challenge, { iconKey: meal.iconKey, i18n: reorderKeys(meal.i18n) });
    updateCalls.length = 0;
    const second = await backfillI18n(prisma);
    assert.deepEqual(updateCalls, []);
    assert.deepEqual(second.legacy.skipped.sort(), ["lunch-regular", "meal-for-stranger"]);
  });

  test("a renamed badge is skipped and left untouched", async () => {
    const owl = LEGACY_BADGES.find((b) => b.slug === "night-owl")!;
    const { prisma, updateCalls } = f1Prisma({ badges: [{ id: "b2", slug: owl.slug, name: "Late Diner", description: owl.i18n.en.description, iconKey: null, iconEmoji: null, i18n: null }] });
    const result = await backfillI18n(prisma);
    assert.deepEqual(result.legacy.mismatched, ["night-owl"]);
    assert.deepEqual(updateCalls, []);
  });

  test("every seed has all four locales and no emoji", () => {
    for (const s of [...LEGACY_BADGES, ...LEGACY_CHALLENGES]) {
      for (const loc of ["en", "zh-TW", "zh-CN", "es"] as const) {
        assert.ok(s.i18n[loc].name && s.i18n[loc].description, `${s.slug} ${loc}`);
        assert.doesNotMatch(JSON.stringify(s.i18n[loc]), /\p{Extended_Pictographic}|—/u);
      }
    }
  });
});

describe("backfillI18n (F1): menu names and descriptions", () => {
  test("replaces a known catering-era English description and fills empty locale columns", async () => {
    const row = { id: "m1", name: classic.name, description: classic.replacesEn![0], descriptionZhTW: null, descriptionZhCN: "", descriptionEs: null };
    const { prisma, updateCalls } = f1Prisma({ menu: [row] });

    const dry = await backfillI18n(prisma, { dryRun: true });
    assert.deepEqual(updateCalls, [], "dry-run must not write");
    assert.deepEqual(dry.menuCopy.updated, ["Classic Beef Noodle Soup:m1"]);

    await backfillI18n(prisma);
    assert.equal(updateCalls.length, 1);
    const data = updateCalls[0].args.data;
    assert.equal(data.description, classic.en);
    assert.equal(data.descriptionZhTW, classic.descriptions!["zh-TW"]);
    assert.equal(data.descriptionZhCN, classic.descriptions!["zh-CN"]);
    assert.equal(data.descriptionEs, classic.descriptions!.es);
  });

  test("never overwrites an English description someone edited, nor an existing translation", async () => {
    const edited = { id: "m2", name: classic.name, description: "Our owner's own words.", descriptionZhTW: null, descriptionZhCN: null, descriptionEs: null };
    const translated = { id: "m3", name: thinFlat.name, description: thinFlat.en, nameZhTW: "自訂名稱", nameZhCN: null, nameEs: null, descriptionZhTW: "自訂描述", descriptionZhCN: null, descriptionEs: null };
    const { prisma, updateCalls } = f1Prisma({ menu: [edited, translated] });

    const result = await backfillI18n(prisma);
    assert.deepEqual(result.menuCopy.mismatched, ["Classic Beef Noodle Soup:m2"]);
    assert.equal(updateCalls.length, 1);
    const data = updateCalls[0].args.data;
    assert.equal(updateCalls[0].args.where.id, "m3");
    assert.ok(!("description" in data) && !("nameZhTW" in data) && !("descriptionZhTW" in data));
    assert.equal(data.nameZhCN, thinFlat.names!["zh-CN"]);
    assert.equal(data.nameEs, thinFlat.names!.es);
  });

  test("is idempotent once the row carries the copy", async () => {
    const done = {
      id: "m4",
      name: thinFlat.name,
      description: thinFlat.en,
      nameZhTW: thinFlat.names!["zh-TW"],
      nameZhCN: thinFlat.names!["zh-CN"],
      nameEs: thinFlat.names!.es,
      descriptionZhTW: thinFlat.descriptions!["zh-TW"],
      descriptionZhCN: thinFlat.descriptions!["zh-CN"],
      descriptionEs: thinFlat.descriptions!.es,
    };
    const { prisma, updateCalls } = f1Prisma({ menu: [done] });
    const result = await backfillI18n(prisma);
    assert.deepEqual(updateCalls, []);
    assert.deepEqual(result.menuCopy.skipped, ["Thin/Flat Noodles:m4"]);
  });

  test("the copy has every locale, no em dashes and no emoji, and no catering-era wording", () => {
    for (const m of MENU_COPY) {
      const text = JSON.stringify({ en: m.en, names: m.names, descriptions: m.descriptions });
      assert.doesNotMatch(text, /\p{Extended_Pictographic}|—/u, m.name);
      assert.doesNotMatch(m.en ?? "", /your event|guests/i, m.name);
      for (const loc of ["zh-TW", "zh-CN", "es"] as const) assert.ok(m.descriptions?.[loc], `${m.name} ${loc}`);
    }
  });
});
