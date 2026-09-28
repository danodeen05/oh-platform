/**
 * Task F1a, item 5: API read-path localizers for badges, challenges,
 * locations and slider labels. Pure unit tests against
 * packages/api/src/i18n/localize.js (no DB, no Fastify app -- index.js
 * calls app.listen() unconditionally at import time, so it is never
 * imported directly from tests; see packages/api/src/orders/__tests__/
 * pricing.test.js for the same reasoning applied to seed-prod.ts).
 *
 * Fix round 1 (review, Critical 1 + Important 1): `labels` is never
 * overwritten (a separate `displayLabels` field carries the localized
 * slider labels), and the row's own name/description/address columns are
 * the source of English -- `i18n.en` is documentation only and is never
 * read by any localizer, even for `locale === "en"`.
 *
 * Run with: pnpm --filter @oh/api test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  localizeBadge,
  localizeChallenge,
  localizeLocation,
  localizeMenuItem,
} from "../localize.js";

const badge = {
  id: "b1",
  slug: "first-order",
  name: "First Bowl",
  description: "Ordered your first bowl of noodles",
  iconKey: "first-order",
  i18n: {
    // Deliberately stale/different from the row's own columns above, to
    // prove en never reads this -- an admin edit to name/description must
    // show up in English immediately, without touching i18n.
    en: { name: "STALE English (must never be read)", description: "STALE description" },
    "zh-TW": { name: "第一碗", description: "點了你的第一碗麵" },
    "zh-CN": { name: "第一碗", description: "点了你的第一碗面" },
    es: { name: "Primer tazón", description: "Pediste tu primer tazón de fideos" },
  },
};

const challenge = {
  id: "c1",
  slug: "early-bird",
  name: "Early Bird",
  description: "Order before 11am",
  iconKey: "early-bird",
  i18n: {
    en: { name: "STALE (must never be read)", description: "STALE" },
    "zh-TW": { name: "早起的鳥兒", description: "上午 11 點前完成點餐" },
    "zh-CN": { name: "早起的鸟儿", description: "上午 11 点前完成点餐" },
    es: { name: "Madrugador", description: "Ordena antes de las 11 a.m." },
  },
};

const location = {
  id: "l1",
  slug: "city-creek",
  name: "City Creek Mall",
  address: "50 S Main St, Salt Lake City, UT 84101",
  i18n: {
    en: { name: "STALE (must never be read)", address: "STALE", landmarks: "STALE" },
    "zh-TW": { name: "城溪購物中心（City Creek Mall）", address: "50 S Main St, Salt Lake City, UT 84101", landmarks: "鄰近聖殿廣場" },
    "zh-CN": { name: "城溪购物中心（City Creek Mall）", address: "50 S Main St, Salt Lake City, UT 84101", landmarks: "邻近圣殿广场" },
    es: { name: "City Creek Mall", address: "50 S Main St, Salt Lake City, UT 84101", landmarks: "Cerca de Temple Square" },
  },
};

describe("localizeBadge", () => {
  test("returns zh-TW copy when asked", () => {
    const result = localizeBadge(badge, "zh-TW");
    assert.equal(result.name, "第一碗");
    assert.equal(result.description, "點了你的第一碗麵");
    assert.equal(result.iconKey, "first-order");
  });

  test("uses the row's own columns for en, never i18n.en", () => {
    const result = localizeBadge(badge, "en");
    assert.equal(result.name, "First Bowl");
    assert.equal(result.description, "Ordered your first bowl of noodles");
  });

  test("falls back to the row's own columns when locale is missing", () => {
    const result = localizeBadge(badge, undefined);
    assert.equal(result.name, "First Bowl");
    assert.equal(result.description, "Ordered your first bowl of noodles");
  });

  test("falls back to the row's own columns when locale is unknown", () => {
    const result = localizeBadge(badge, "fr");
    assert.equal(result.name, "First Bowl");
  });

  test("falls back to the raw name/description when i18n is missing (old rows)", () => {
    const noI18n = { id: "b2", slug: "vip", name: "VIP", description: "VIP member status", iconKey: null, i18n: null };
    const result = localizeBadge(noI18n, "zh-TW");
    assert.equal(result.name, "VIP");
    assert.equal(result.description, "VIP member status");
  });

  test("passes through a null badge", () => {
    assert.equal(localizeBadge(null, "zh-TW"), null);
  });
});

describe("localizeChallenge", () => {
  test("returns zh-CN copy when asked", () => {
    const result = localizeChallenge(challenge, "zh-CN");
    assert.equal(result.name, "早起的鸟儿");
    assert.equal(result.description, "上午 11 点前完成点餐");
    assert.equal(result.iconKey, "early-bird");
  });

  test("uses the row's own columns for en, never i18n.en", () => {
    const result = localizeChallenge(challenge, "en");
    assert.equal(result.name, "Early Bird");
    assert.equal(result.description, "Order before 11am");
  });

  test("falls back to the row's own columns when locale is missing", () => {
    const result = localizeChallenge(challenge, undefined);
    assert.equal(result.name, "Early Bird");
  });
});

describe("localizeLocation", () => {
  test("returns zh-TW name and address when asked", () => {
    const result = localizeLocation(location, "zh-TW");
    assert.equal(result.name, "城溪購物中心（City Creek Mall）");
    assert.equal(result.landmarks, "鄰近聖殿廣場");
  });

  test("uses the row's own columns for en, never i18n.en", () => {
    const result = localizeLocation(location, "en");
    assert.equal(result.name, "City Creek Mall");
    assert.equal(result.address, "50 S Main St, Salt Lake City, UT 84101");
  });

  test("falls back to the row's own columns when locale is missing", () => {
    const result = localizeLocation(location, undefined);
    assert.equal(result.name, "City Creek Mall");
  });

  test("falls back to the raw name/address when i18n is missing (old rows)", () => {
    const noI18n = { id: "l2", slug: "university-place", name: "University Place", address: "575 E University Pkwy, Orem, UT 84097", i18n: null };
    const result = localizeLocation(noI18n, "zh-TW");
    assert.equal(result.name, "University Place");
  });
});

describe("localizeMenuItem slider labels", () => {
  const sliderItem = {
    id: "m1",
    name: "Soup Richness",
    nameZhTW: "湯頭濃度",
    sliderConfig: {
      min: 0,
      max: 3,
      step: 1,
      default: 1,
      labels: ["Light", "Medium", "Rich", "Extra Rich"],
      labelsI18n: {
        en: ["Light", "Medium", "Rich", "Extra Rich"],
        "zh-TW": ["清淡", "中等", "濃郁", "特濃"],
        "zh-CN": ["清淡", "中等", "浓郁", "特浓"],
        es: ["Ligero", "Medio", "Intenso", "Extra Intenso"],
      },
    },
  };

  test("Critical 1: sliderConfig.labels is unchanged for zh-TW (it is canonical order data, not display text)", () => {
    const result = localizeMenuItem(sliderItem, "zh-TW");
    assert.deepEqual(result.sliderConfig.labels, ["Light", "Medium", "Rich", "Extra Rich"]);
  });

  test("adds sliderConfig.displayLabels with the zh-TW translation", () => {
    const result = localizeMenuItem(sliderItem, "zh-TW");
    assert.deepEqual(result.sliderConfig.displayLabels, ["清淡", "中等", "濃郁", "特濃"]);
    // Other sliderConfig fields must survive untouched.
    assert.equal(result.sliderConfig.min, 0);
    assert.equal(result.sliderConfig.max, 3);
    assert.equal(result.sliderConfig.default, 1);
  });

  test("displayLabels falls back to sliderConfig.labels when locale is missing", () => {
    const result = localizeMenuItem(sliderItem, undefined);
    assert.deepEqual(result.sliderConfig.displayLabels, ["Light", "Medium", "Rich", "Extra Rich"]);
    assert.deepEqual(result.sliderConfig.labels, ["Light", "Medium", "Rich", "Extra Rich"]);
  });

  test("Fix round 2: for en, displayLabels is always sliderConfig.labels, even when labelsI18n.en differs from it", () => {
    const item = {
      id: "m3",
      name: "Soup Richness",
      sliderConfig: {
        labels: ["Light", "Medium", "Rich", "Extra Rich"],
        labelsI18n: {
          // Deliberately different from `labels`, to prove en never reads
          // labelsI18n.en -- the row's own `labels` is canonical.
          en: ["STALE", "STALE", "STALE", "STALE"],
          "zh-TW": ["清淡", "中等", "濃郁", "特濃"],
        },
      },
    };
    const result = localizeMenuItem(item, "en");
    assert.deepEqual(result.sliderConfig.displayLabels, ["Light", "Medium", "Rich", "Extra Rich"]);
  });

  test("Fix round 2: a labelsI18n[locale] array whose length doesn't match labels falls back to labels", () => {
    const item = {
      id: "m4",
      name: "Spice Level",
      sliderConfig: {
        labels: ["None", "Mild", "Medium", "Spicy", "Extra Spicy"],
        labelsI18n: {
          en: ["None", "Mild", "Medium", "Spicy", "Extra Spicy"],
          // Re-purposed/stale: only 3 entries for a 5-label slider.
          "zh-TW": ["無", "微辣", "特辣"],
        },
      },
    };
    const result = localizeMenuItem(item, "zh-TW");
    assert.deepEqual(result.sliderConfig.displayLabels, ["None", "Mild", "Medium", "Spicy", "Extra Spicy"]);
  });

  test("Fix round 2: a non-array labelsI18n[locale] falls back to labels", () => {
    const item = {
      id: "m5",
      name: "Noodle Texture",
      sliderConfig: {
        labels: ["Firm", "Medium", "Soft"],
        labelsI18n: { en: ["Firm", "Medium", "Soft"], "zh-TW": "not an array" },
      },
    };
    const result = localizeMenuItem(item, "zh-TW");
    assert.deepEqual(result.sliderConfig.displayLabels, ["Firm", "Medium", "Soft"]);
  });

  test("displayLabels falls back to labels when there is no labelsI18n (backward compatible)", () => {
    const oldItem = { id: "m2", name: "Old Slider", sliderConfig: { min: 0, max: 2, labels: ["A", "B", "C"] } };
    const result = localizeMenuItem(oldItem, "zh-TW");
    assert.deepEqual(result.sliderConfig.labels, ["A", "B", "C"]);
    assert.deepEqual(result.sliderConfig.displayLabels, ["A", "B", "C"]);
  });

  test("still localizes name/description for a non-slider item", () => {
    const result = localizeMenuItem(sliderItem, "zh-TW");
    assert.equal(result.name, "湯頭濃度");
    assert.equal(result.nameEn, "Soup Richness");
  });

  test("passes through a null item", () => {
    assert.equal(localizeMenuItem(null, "zh-TW"), null);
  });
});
