/**
 * Task F1a, item 6: every seeded badge and challenge has real translations
 * in all 4 locales, no emoji, no em dash, and an `iconKey` that exists in
 * the SEALS glyph map (Task C2). Also covers the location and slider-label
 * i18n from the same lane.
 *
 * Run with: pnpm --filter @oh/db test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BADGES } from "../../prisma/seed-data/badges.ts";
import { CHALLENGES } from "../../prisma/seed-data/challenges.ts";
import { LOCATION_I18N } from "../../prisma/seed-data/locations.ts";
import { SLIDER_LABELS_I18N } from "../../prisma/seed-data/slider-labels.ts";
import { DEV_BADGE_DESCRIPTION, DEV_BADGE_I18N_OVERRIDE, DEV_CHALLENGE_DESCRIPTION } from "../../prisma/seed-data/dev-overrides.ts";

const LOCALES = ["en", "zh-TW", "zh-CN", "es"] as const;

// Matches emoji codepoints without flagging plain CJK text (same pattern as
// apps/web/lib/site/__tests__/no-emoji.test.ts).
const EMOJI = /\p{Extended_Pictographic}/u;
const EM_DASH = "—";

/**
 * SEALS is defined in apps/web (a different workspace package) as plain
 * data with no side effects, but this package's tests read it as text
 * rather than importing across the package boundary (same convention as
 * packages/api/src/orders/__tests__/pricing.test.js reading seed-prod.ts).
 */
function sealKeys(): Set<string> {
  const src = readFileSync(
    new URL("../../../../apps/web/components/site/seal/seals.ts", import.meta.url),
    "utf8",
  );
  const keys = new Set<string>();
  const re = /^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+)):\s*\{\s*glyph:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    keys.add(m[1] ?? m[2]);
  }
  return keys;
}

describe("badge and challenge i18n seed data", () => {
  const SEALS = sealKeys();

  test("SEALS keys were actually found (sanity check on the regex)", () => {
    assert.ok(SEALS.size >= 14, `expected at least 14 SEALS keys, found ${SEALS.size}`);
  });

  for (const badge of BADGES) {
    test(`badge "${badge.slug}" has all 4 locales, no emoji, no em dash`, () => {
      for (const locale of LOCALES) {
        const copy = badge.i18n[locale];
        assert.ok(copy, `missing locale ${locale} for badge ${badge.slug}`);
        assert.ok(copy.name.trim().length > 0, `empty name for ${badge.slug}/${locale}`);
        assert.ok(copy.description.trim().length > 0, `empty description for ${badge.slug}/${locale}`);
        assert.ok(!EMOJI.test(copy.name), `emoji in name for ${badge.slug}/${locale}`);
        assert.ok(!EMOJI.test(copy.description), `emoji in description for ${badge.slug}/${locale}`);
        assert.ok(!copy.name.includes(EM_DASH), `em dash in name for ${badge.slug}/${locale}`);
        assert.ok(!copy.description.includes(EM_DASH), `em dash in description for ${badge.slug}/${locale}`);
      }
    });

    test(`badge "${badge.slug}" iconKey exists in SEALS`, () => {
      assert.ok(SEALS.has(badge.iconKey), `iconKey "${badge.iconKey}" not found in SEALS`);
    });
  }

  for (const challenge of CHALLENGES) {
    test(`challenge "${challenge.slug}" has all 4 locales, no emoji, no em dash`, () => {
      for (const locale of LOCALES) {
        const copy = challenge.i18n[locale];
        assert.ok(copy, `missing locale ${locale} for challenge ${challenge.slug}`);
        assert.ok(copy.name.trim().length > 0, `empty name for ${challenge.slug}/${locale}`);
        assert.ok(copy.description.trim().length > 0, `empty description for ${challenge.slug}/${locale}`);
        assert.ok(!EMOJI.test(copy.name), `emoji in name for ${challenge.slug}/${locale}`);
        assert.ok(!EMOJI.test(copy.description), `emoji in description for ${challenge.slug}/${locale}`);
        assert.ok(!copy.name.includes(EM_DASH), `em dash in name for ${challenge.slug}/${locale}`);
        assert.ok(!copy.description.includes(EM_DASH), `em dash in description for ${challenge.slug}/${locale}`);
      }
    });

    test(`challenge "${challenge.slug}" iconKey exists in SEALS`, () => {
      assert.ok(SEALS.has(challenge.iconKey), `iconKey "${challenge.iconKey}" not found in SEALS`);
    });
  }

  test("zh-TW differs from zh-CN for at least one badge or challenge (not a naive character conversion)", () => {
    const differs = [...BADGES, ...CHALLENGES].some(
      (entry) =>
        entry.i18n["zh-TW"].name !== entry.i18n["zh-CN"].name &&
        // A pure traditional/simplified conversion would still differ
        // char-for-char; require a real length or word difference to catch
        // that case too (all our diverging entries use different words).
        entry.i18n["zh-TW"].name.length !== entry.i18n["zh-CN"].name.length,
    );
    assert.ok(differs, "expected at least one entry where zh-TW and zh-CN use different words, not just different character sets");
  });

  test("every badge slug is unique", () => {
    const slugs = BADGES.map((b) => b.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test("every challenge slug is unique", () => {
    const slugs = CHALLENGES.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });
});

describe("location i18n seed data", () => {
  for (const slug of ["city-creek", "university-place"]) {
    test(`location "${slug}" has all 4 locales, no emoji, no em dash (including landmarks)`, () => {
      const entry = LOCATION_I18N[slug];
      assert.ok(entry, `missing LOCATION_I18N entry for ${slug}`);
      for (const locale of LOCALES) {
        const copy = entry[locale];
        assert.ok(copy, `missing locale ${locale} for location ${slug}`);
        assert.ok(copy.name.trim().length > 0);
        assert.ok(copy.address.trim().length > 0);
        assert.ok(!EMOJI.test(copy.name));
        assert.ok(!EMOJI.test(copy.address));
        assert.ok(!copy.name.includes(EM_DASH));
        assert.ok(!copy.address.includes(EM_DASH));
        // Fix round 1 (review, Minor 6): landmarks wasn't checked before.
        if (copy.landmarks) {
          assert.ok(!EMOJI.test(copy.landmarks), `emoji in landmarks for ${slug}/${locale}`);
          assert.ok(!copy.landmarks.includes(EM_DASH), `em dash in landmarks for ${slug}/${locale}`);
        }
      }
    });
  }
});

describe("slider labelsI18n seed data", () => {
  for (const category of ["slider01", "slider02", "slider03", "slider04", "slider05", "slider06", "slider07", "slider08"]) {
    test(`${category} has matching-length label arrays for all 4 locales, no emoji, no em dash`, () => {
      const entry = SLIDER_LABELS_I18N[category];
      assert.ok(entry, `missing SLIDER_LABELS_I18N entry for ${category}`);
      const enLength = entry.en.length;
      for (const locale of LOCALES) {
        assert.equal(entry[locale].length, enLength, `${category}/${locale} label count mismatch`);
        for (const label of entry[locale]) {
          assert.ok(label.trim().length > 0);
          assert.ok(!EMOJI.test(label));
          assert.ok(!label.includes(EM_DASH));
        }
      }
    });
  }

  // Fix round 1 (review, Minor 6): nothing asserted that labelsI18n.en
  // actually matches the English `labels` seeded in seed-prod.ts (the
  // canonical order-data values, per Critical 1). seed-prod.ts is read as
  // text rather than imported, since it runs main() unconditionally at
  // import time (same convention as pricing.test.js reading it for the
  // menu fixture).
  test("labelsI18n.en matches the sliderConfig.labels seeded in seed-prod.ts, for every slider", () => {
    const src = readFileSync(new URL("../../prisma/seed-prod.ts", import.meta.url), "utf8");
    for (const category of Object.keys(SLIDER_LABELS_I18N)) {
      const re = new RegExp(`category: '${category}'[\\s\\S]*?\\blabels:\\s*\\[([^\\]]*)\\]`);
      const match = re.exec(src);
      assert.ok(match, `could not find sliderConfig.labels for ${category} in seed-prod.ts`);
      const seededLabels = JSON.parse(`[${match![1].replace(/'/g, '"')}]`);
      assert.deepEqual(SLIDER_LABELS_I18N[category].en, seededLabels, `${category}: labelsI18n.en must match seed-prod.ts's sliderConfig.labels`);
    }
  });
});

describe("dev seed overrides (packages/db/prisma/seed.ts)", () => {
  test("every override description is non-empty, no emoji, no em dash", () => {
    for (const [slug, description] of Object.entries(DEV_BADGE_DESCRIPTION)) {
      assert.ok(description.trim().length > 0, `empty DEV_BADGE_DESCRIPTION for ${slug}`);
      assert.ok(!EMOJI.test(description), `emoji in DEV_BADGE_DESCRIPTION for ${slug}`);
      assert.ok(!description.includes(EM_DASH), `em dash in DEV_BADGE_DESCRIPTION for ${slug}`);
    }
    for (const [slug, description] of Object.entries(DEV_CHALLENGE_DESCRIPTION)) {
      assert.ok(description.trim().length > 0, `empty DEV_CHALLENGE_DESCRIPTION for ${slug}`);
      assert.ok(!EMOJI.test(description), `emoji in DEV_CHALLENGE_DESCRIPTION for ${slug}`);
      assert.ok(!description.includes(EM_DASH), `em dash in DEV_CHALLENGE_DESCRIPTION for ${slug}`);
    }
  });

  test("every full i18n override has all 4 locales, no emoji, no em dash", () => {
    for (const [slug, i18n] of Object.entries(DEV_BADGE_I18N_OVERRIDE)) {
      for (const locale of LOCALES) {
        const copy = (i18n as any)[locale];
        assert.ok(copy, `missing locale ${locale} for DEV_BADGE_I18N_OVERRIDE.${slug}`);
        assert.ok(copy.name.trim().length > 0);
        assert.ok(copy.description.trim().length > 0);
        assert.ok(!EMOJI.test(copy.name));
        assert.ok(!EMOJI.test(copy.description));
        assert.ok(!copy.name.includes(EM_DASH));
        assert.ok(!copy.description.includes(EM_DASH));
      }
    }
  });

  // Fix round 1 (review, Important 4): regression test for the exact bug --
  // the dev seed's "vip" badge must reference the real beefBoss tier name
  // (loyalty.tiers.beefBoss: 牛肉達人 / 牛肉达人 / "Jefe de la Carne"), never
  // the made-up "牛霸主" / "Beef Boss".
  test('the "vip" override names the real beefBoss tier, not a made-up one', () => {
    const vip = DEV_BADGE_I18N_OVERRIDE.vip;
    assert.ok(vip, "DEV_BADGE_I18N_OVERRIDE.vip must exist");
    assert.match(vip["zh-TW"].description, /牛肉達人/);
    assert.match(vip["zh-CN"].description, /牛肉达人/);
    assert.match(vip.es.description, /Jefe de la Carne/);
    assert.doesNotMatch(vip["zh-TW"].description, /牛霸主/);
    assert.doesNotMatch(vip["zh-CN"].description, /牛霸主/);
  });
});
