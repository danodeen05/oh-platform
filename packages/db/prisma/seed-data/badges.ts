/**
 * Badge catalog for the production-style seed (packages/db/prisma/seed-prod.ts)
 * and the idempotent backfill (packages/db/scripts/backfill-i18n.ts).
 *
 * `iconKey` matches the SEALS map in
 * apps/web/components/site/seal/seals.ts (Task C2) -- an in-house glyph,
 * replacing the old `iconEmoji`.
 *
 * `i18n.en` is the single source of truth for the English copy: seed-prod.ts
 * writes it into the top-level `name`/`description` columns too, so there is
 * exactly one place to edit English text.
 *
 * zh-TW uses Taiwan usage and zh-CN uses mainland usage. These are
 * independent translations, not a character-set conversion of each other
 * (see e.g. "10-referrals", "grand-opening", "vip" and "spicy-challenge"
 * below, which use different words, not just different character sets).
 *
 * This module is pure data (no PrismaClient, no side effects), so it is
 * safe to import directly from tests.
 */

export interface LocaleCopy {
  name: string;
  description: string;
}

export interface I18nCopy {
  en: LocaleCopy;
  "zh-TW": LocaleCopy;
  "zh-CN": LocaleCopy;
  es: LocaleCopy;
}

export type BadgeCategory = "MILESTONE" | "CHALLENGE" | "REFERRAL" | "SPECIAL" | "STREAK";

export interface BadgeSeed {
  id: string;
  slug: string;
  category: BadgeCategory;
  iconKey: string;
  i18n: I18nCopy;
}

export const BADGES: BadgeSeed[] = [
  {
    id: "cmip6jc1f00362nnnnbmu4xdk",
    slug: "first-order",
    category: "MILESTONE",
    iconKey: "first-order",
    i18n: {
      en: { name: "First Bowl", description: "Ordered your first bowl of noodles" },
      "zh-TW": { name: "第一碗", description: "點了你的第一碗麵" },
      "zh-CN": { name: "第一碗", description: "点了你的第一碗面" },
      es: { name: "Primer Tazón", description: "Pediste tu primer tazón de fideos" },
    },
  },
  {
    id: "cmip6jc1f00372nnnvjx2b00h",
    slug: "10-orders",
    category: "MILESTONE",
    iconKey: "10-orders",
    i18n: {
      en: { name: "Noodle Enthusiast", description: "Completed 10 orders" },
      "zh-TW": { name: "麵食愛好者", description: "完成了 10 次點餐" },
      "zh-CN": { name: "面食爱好者", description: "完成了 10 次点餐" },
      es: { name: "Entusiasta de los fideos", description: "Completaste 10 pedidos" },
    },
  },
  {
    id: "cmip6jc1f00382nnn5pq8tnau",
    slug: "50-orders",
    category: "MILESTONE",
    iconKey: "50-orders",
    i18n: {
      en: { name: "Beef Devotee", description: "Completed 50 orders" },
      "zh-TW": { name: "牛肉粉絲", description: "完成了 50 次點餐" },
      "zh-CN": { name: "牛肉粉丝", description: "完成了 50 次点餐" },
      // "Devoto de la carne" to match the tier name "Jefe de la Carne".
      es: { name: "Devoto de la carne", description: "Completaste 50 pedidos" },
    },
  },
  {
    id: "cmip6jc1f00392nnnhzmay5y0",
    slug: "100-orders",
    category: "MILESTONE",
    iconKey: "100-orders",
    i18n: {
      en: { name: "Century Club", description: "Completed 100 orders" },
      "zh-TW": { name: "百碗俱樂部", description: "完成了 100 次點餐" },
      "zh-CN": { name: "百碗俱乐部", description: "完成了 100 次点餐" },
      es: { name: "Club de los cien", description: "Completaste 100 pedidos" },
    },
  },
  {
    id: "cmip6jc1f003a2nnnabck2fc3",
    slug: "first-referral",
    category: "REFERRAL",
    iconKey: "first-referral",
    i18n: {
      en: { name: "Share the Love", description: "Referred your first friend" },
      "zh-TW": { name: "分享好味道", description: "邀請了第一位朋友" },
      "zh-CN": { name: "分享好味道", description: "邀请了第一位朋友" },
      es: { name: "Comparte el cariño", description: "Invitaste a tu primer amigo" },
    },
  },
  {
    id: "cmip6jc1f003b2nnnqit3ocm3",
    slug: "10-referrals",
    category: "REFERRAL",
    iconKey: "10-referrals",
    i18n: {
      // Fix round 1 (review, Important 5): "带货达人" means a livestream
      // merchandise seller and read as commercial selling, not referring
      // friends. "人气推荐官" (a popularity-driven recommender) is the
      // mainland word for this; TW "人氣推手" (a word-of-mouth booster) was
      // already fine and is unchanged. Still genuinely different words, not
      // a character-set conversion of each other.
      en: { name: "Influencer", description: "Referred 10 friends" },
      "zh-TW": { name: "人氣推手", description: "邀請了 10 位朋友" },
      "zh-CN": { name: "人气推荐官", description: "邀请了 10 位朋友" },
      es: { name: "Influencer", description: "Invitaste a 10 amigos" },
    },
  },
  {
    id: "cmip6jc1f003c2nnn2qovjr1w",
    slug: "50-referrals",
    category: "REFERRAL",
    iconKey: "50-referrals",
    i18n: {
      en: { name: "Ambassador", description: "Referred 50 friends" },
      "zh-TW": { name: "品牌大使", description: "邀請了 50 位朋友" },
      "zh-CN": { name: "品牌大使", description: "邀请了 50 位朋友" },
      es: { name: "Embajador", description: "Invitaste a 50 amigos" },
    },
  },
  {
    id: "cmip6jc1f003d2nnnj5lhrdap",
    slug: "3-day-streak",
    category: "STREAK",
    iconKey: "3-day-streak",
    i18n: {
      // Fix round 1 (review, Important 5): 手氣 means gambling or game
      // luck, wrong connotation for an ordering habit streak. 熱度不減 /
      // 热度不减 ("the heat hasn't faded") reads naturally for both.
      en: { name: "Hot Streak", description: "Ordered 3 days in a row" },
      "zh-TW": { name: "熱度不減", description: "連續 3 天點餐" },
      "zh-CN": { name: "热度不减", description: "连续 3 天点餐" },
      es: { name: "Racha ganadora", description: "Pediste 3 días seguidos" },
    },
  },
  {
    id: "cmip6jc1f003e2nnnmsaafisv",
    slug: "7-day-streak",
    category: "STREAK",
    iconKey: "7-day-streak",
    i18n: {
      en: { name: "Weekly Warrior", description: "Ordered 7 days in a row" },
      "zh-TW": { name: "一週戰士", description: "連續 7 天點餐" },
      "zh-CN": { name: "一周战士", description: "连续 7 天点餐" },
      es: { name: "Guerrero semanal", description: "Pediste 7 días seguidos" },
    },
  },
  {
    id: "cmip6jc1f003f2nnnwuv9pa4k",
    slug: "30-day-streak",
    category: "STREAK",
    iconKey: "30-day-streak",
    i18n: {
      en: { name: "Legend", description: "Ordered 30 days in a row" },
      "zh-TW": { name: "傳奇人物", description: "連續 30 天點餐" },
      "zh-CN": { name: "传奇人物", description: "连续 30 天点餐" },
      es: { name: "Leyenda", description: "Pediste 30 días seguidos" },
    },
  },
  {
    id: "cmip6jc1f003g2nnnpciz90gx",
    slug: "tried-all-items",
    category: "CHALLENGE",
    iconKey: "tried-all-items",
    i18n: {
      // TW "達人" and CN "大师" both translate as "master/expert" but are
      // distinct, commonly-used words in each region.
      en: { name: "Menu Master", description: "Tried every item on the menu" },
      "zh-TW": { name: "菜單達人", description: "吃遍菜單上每一道" },
      "zh-CN": { name: "菜单大师", description: "吃遍菜单上的每一道菜" },
      es: { name: "Maestro del menú", description: "Probaste todo el menú" },
    },
  },
  {
    id: "cmip6jc1f003h2nnn3116tr0v",
    slug: "spicy-challenge",
    category: "CHALLENGE",
    iconKey: "spicy-challenge",
    i18n: {
      // TW "無辣不歡" (a common Taiwan idiom, "no fun without spice") vs CN
      // "嗜辣达人" (mainland phrasing, "spice-loving expert") -- different
      // wording, not a conversion.
      en: { name: "Heat Seeker", description: "Ordered max spice level" },
      "zh-TW": { name: "無辣不歡", description: "點了最高辣度" },
      "zh-CN": { name: "嗜辣达人", description: "点了最高辣度" },
      es: { name: "Amante del picante", description: "Pediste el nivel de picante máximo" },
    },
  },
  {
    id: "cmip6jc1f003i2nnn2tcyznmn",
    slug: "grand-opening",
    category: "SPECIAL",
    iconKey: "grand-opening",
    i18n: {
      // TW "開幕" (grand-opening ceremony) vs CN "开业" (starting business) --
      // both mean "opened", but they are the words each region actually uses.
      en: { name: "OG Member", description: "Member since grand opening" },
      "zh-TW": { name: "元老會員", description: "開幕時就加入的會員" },
      "zh-CN": { name: "创始会员", description: "开业之初就加入的会员" },
      es: { name: "Miembro fundador", description: "Miembro desde la gran apertura" },
    },
  },
  {
    id: "cmip6jc1f003j2nnn963gxsan",
    slug: "vip",
    category: "SPECIAL",
    iconKey: "vip",
    i18n: {
      // TW "貴賓/身分" vs CN "尊享会员/身份" -- different framing and the
      // well-known TW/CN character preference for "status" (身分 vs 身份).
      en: { name: "VIP", description: "VIP member status" },
      "zh-TW": { name: "貴賓", description: "貴賓會員身分" },
      "zh-CN": { name: "尊享会员", description: "尊享会员身份" },
      es: { name: "VIP", description: "Estatus de miembro VIP" },
    },
  },
];
