/**
 * Task F1: the badges and the challenge that were added to prod by one-off
 * scripts (prisma/add-new-badges.js, prisma/add-meal-gift-challenge.js)
 * rather than by the seed, so they are not in BADGES / CHALLENGES (those
 * carry fixed ids for seed-prod.ts; these rows have whatever id prod gave
 * them). The backfill (scripts/backfill-i18n.ts) updates them by slug only,
 * with the same rules as the seeded rows: English is never written, and a
 * row whose English differs from `i18n.en` is skipped and logged.
 *
 * `iconKey` matches the SEALS map in apps/web/components/site/seal/seals.ts.
 * zh-TW uses Taiwan usage and zh-CN mainland usage (see badges.ts).
 *
 * Pure data, safe to import from tests.
 */
import type { I18nCopy } from "./badges";

export interface LegacyCopySeed {
  slug: string;
  iconKey: string;
  i18n: I18nCopy;
  /**
   * Other English texts the same row may carry, each with its own
   * translations. The backfill writes whichever copy's `en` matches the row.
   */
  alternates?: I18nCopy[];
}

export const LEGACY_BADGES: LegacyCopySeed[] = [
  {
    slug: "lunch-regular",
    iconKey: "lunch-regular",
    i18n: {
      en: { name: "Lunch Regular", description: "Ordered during lunch hours 10 times" },
      "zh-TW": { name: "午餐常客", description: "在午餐時段點餐 10 次" },
      "zh-CN": { name: "午餐常客", description: "在午餐时段点餐 10 次" },
      es: { name: "Cliente del almuerzo", description: "Pediste en horario de almuerzo 10 veces" },
    },
  },
  {
    slug: "night-owl",
    iconKey: "night-owl",
    i18n: {
      en: { name: "Night Owl", description: "Ordered after 8pm 5 times" },
      "zh-TW": { name: "夜貓子", description: "晚上 8 點後點餐 5 次" },
      "zh-CN": { name: "夜猫子", description: "晚上 8 点后下单 5 次" },
      es: { name: "Ave nocturna", description: "Pediste después de las 8 p. m. 5 veces" },
    },
  },
  {
    slug: "big-spender",
    iconKey: "big-spender",
    i18n: {
      en: { name: "Big Spender", description: "Spent over $500 lifetime" },
      "zh-TW": { name: "大手筆", description: "累計消費超過 $500" },
      "zh-CN": { name: "豪爽食客", description: "累计消费超过 $500" },
      es: { name: "Gran cliente", description: "Gastaste más de $500 en total" },
    },
  },
  {
    slug: "generous-soul",
    iconKey: "generous-soul",
    i18n: {
      en: { name: "Generous Soul", description: "Referred 3 friends who ordered" },
      "zh-TW": { name: "慷慨之心", description: "推薦 3 位朋友來點餐" },
      "zh-CN": { name: "热心推荐官", description: "推荐 3 位好友完成下单" },
      es: { name: "Alma generosa", description: "Invitaste a 3 amigos que hicieron un pedido" },
    },
  },
  {
    slug: "pod-explorer",
    iconKey: "pod-explorer",
    i18n: {
      en: { name: "Pod Explorer", description: "Dined in 5 different pods" },
      "zh-TW": { name: "包廂探索家", description: "在 5 間不同的包廂用餐" },
      "zh-CN": { name: "包厢探索家", description: "在 5 个不同的包厢用餐" },
      es: { name: "Explorador de cabinas", description: "Comiste en 5 cabinas diferentes" },
    },
  },
  {
    slug: "quick-return",
    iconKey: "quick-return",
    i18n: {
      en: { name: "Quick Return", description: "Ordered again within 24 hours" },
      "zh-TW": { name: "回頭客", description: "24 小時內再次點餐" },
      "zh-CN": { name: "回头客", description: "24 小时内再次下单" },
      es: { name: "Regreso rápido", description: "Volviste a pedir en menos de 24 horas" },
    },
  },
];

export const LEGACY_CHALLENGES: LegacyCopySeed[] = [
  {
    slug: "meal-for-stranger",
    iconKey: "meal-for-stranger",
    i18n: {
      en: { name: "Meal for a Stranger", description: "Gift a meal to the next solo diner at your location" },
      "zh-TW": { name: "請陌生人吃一碗", description: "請同一間門市的下一位單獨用餐者吃一餐" },
      "zh-CN": { name: "请陌生人吃一碗", description: "为同一家门店的下一位独自用餐者送上一餐" },
      es: { name: "Comida para un desconocido", description: "Regala una comida al próximo comensal que venga solo a tu local" },
    },
    // The API creates this row itself when it is missing (packages/api/src/orders/tenders.js,
    // mealGiftChallenge), with the site's own line; the translations match challengesPage.giveTitle.
    alternates: [
      {
        en: { name: "Meal for a Stranger", description: "Buy the next guest a bowl." },
        "zh-TW": { name: "請陌生人吃一碗", description: "為下一位客人買一碗。" },
        "zh-CN": { name: "请陌生人吃一碗", description: "为下一位客人买一碗。" },
        es: { name: "Comida para un desconocido", description: "Invita un tazón al próximo cliente." },
      },
    ],
  },
];
