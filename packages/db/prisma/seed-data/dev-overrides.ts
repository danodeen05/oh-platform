/**
 * packages/db/prisma/seed.ts's badges/challenges are built from BADGES /
 * CHALLENGES (seed-data/badges.ts, seed-data/challenges.ts) plus these
 * small overrides, instead of a second hand-written copy of the whole
 * catalog.
 *
 * Fix round 1 (review, Minor 1): the previous full duplicate copy in
 * seed.ts (and the now-deleted, unreferenced seed.js) was exactly how the
 * "vip" badge's dev-only translation drifted to the wrong tier name
 * (Important 4, 牛霸主 instead of loyalty.tiers.beefBoss's 牛肉達人/牛肉达人)
 * without being caught by any test. Pulling the overrides out into their
 * own pure-data module means they can be tested directly (see
 * packages/db/scripts/__tests__/i18n-seed.test.ts), the same way BADGES and
 * CHALLENGES already are.
 *
 * This module has no side effects (no PrismaClient), so it is safe to
 * import from tests.
 */
import type { I18nCopy } from "./badges";

/** This dev seed's own English story text differs slightly from
 * seed-prod.ts's for a few badges (see seed-data/badges.ts for the prod
 * text); only the description needs overriding, since zh-TW/zh-CN/es come
 * from the single source in BADGES. */
export const DEV_BADGE_DESCRIPTION: Record<string, string> = {
  "first-order": "Completed your first order",
  // "spicy-challenge" and "vip" are in DEV_BADGE_I18N_OVERRIDE below
  // instead (their translations change meaning, not just English wording).
};

/**
 * "vip" and "spicy-challenge" change meaning, not just English wording, in
 * the dev seed, so an English-only override (which would leave BADGES's
 * prod-meaning translations attached to different English) is not enough --
 * they get their own full translations instead:
 *   - "vip" calls out a specific membership tier, which the prod catalog's
 *     "VIP member status" does not. loyalty.tiers.beefBoss is 牛肉達人 /
 *     牛肉达人 / "Jefe de la Carne" (apps/web/messages/*.json), not 牛霸主 /
 *     "Beef Boss".
 *   - "spicy-challenge" counts orders ("10 times"), where the prod version
 *     is about reaching the maximum spice level -- different criteria, so
 *     translating "Ordered spicy 10 times" with a translation that says
 *     "max spice level" would be wrong, not just a style mismatch.
 */
export const DEV_BADGE_I18N_OVERRIDE: Record<string, I18nCopy> = {
  vip: {
    en: { name: "VIP", description: "Reached Beef Boss tier" },
    "zh-TW": { name: "貴賓", description: "達到牛肉達人等級" },
    "zh-CN": { name: "尊享会员", description: "达到牛肉达人等级" },
    es: { name: "VIP", description: "Alcanzaste el nivel Jefe de la Carne" },
  },
  "spicy-challenge": {
    en: { name: "Heat Seeker", description: "Ordered spicy 10 times" },
    "zh-TW": { name: "無辣不歡", description: "點了 10 次辣味餐點" },
    "zh-CN": { name: "嗜辣达人", description: "点了 10 次辣味餐点" },
    es: { name: "Amante del picante", description: "Pediste picante 10 veces" },
  },
};

/** Same idea as DEV_BADGE_DESCRIPTION, for challenges. */
export const DEV_CHALLENGE_DESCRIPTION: Record<string, string> = {
  "try-all-bases": "Order all 4 base noodle dishes",
  "bring-5-friends": "Refer 5 friends this month",
  "early-bird": "Order before 11am five times",
};

/** Dev-only challenge requirements (this fixture's referenced item slugs
 * don't exist in seed-prod.ts's catalog, so these stay dev-specific rather
 * than shared). */
export const DEV_CHALLENGE_REQUIREMENTS: Record<string, unknown> = {
  "try-all-bases": JSON.stringify({
    type: "order_all_items",
    itemSlugs: ["classic-beef", "spicy-beef", "dry-noodles", "wagyu-upgrade"],
  }),
  "bring-5-friends": JSON.stringify({ type: "referrals", count: 5, timeframe: "month" }),
  "early-bird": JSON.stringify({ type: "order_time", before: "11:00", count: 5 }),
};
