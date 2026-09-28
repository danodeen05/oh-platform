/**
 * Challenge catalog for the production-style seed (packages/db/prisma/seed-prod.ts)
 * and the idempotent backfill (packages/db/scripts/backfill-i18n.ts).
 *
 * See badges.ts for the i18n conventions (Taiwan usage vs mainland usage,
 * iconKey matching apps/web/components/site/seal/seals.ts).
 *
 * `Challenge.iconEmoji` is schema-required (left that way in Task A2's
 * migration, which stays frozen); the seed now writes `""` there instead of
 * an emoji, and `iconKey` carries the real icon.
 */
import type { I18nCopy } from "./badges";

export interface ChallengeSeed {
  id: string;
  slug: string;
  iconKey: string;
  rewardCents: number;
  requirements: Record<string, unknown>;
  i18n: I18nCopy;
}

export const CHALLENGES: ChallengeSeed[] = [
  {
    id: "cmip6jc1l003k2nnnoc7o1uve",
    slug: "try-all-bases",
    iconKey: "try-all-bases",
    rewardCents: 500,
    requirements: { type: "try_all_noodles", count: 4 },
    i18n: {
      en: { name: "Noodle Explorer", description: "Try all noodle types" },
      "zh-TW": { name: "麵條探險家", description: "嘗試所有麵條種類" },
      "zh-CN": { name: "面条探险家", description: "尝试所有面条种类" },
      es: { name: "Explorador de fideos", description: "Prueba todos los tipos de fideos" },
    },
  },
  {
    id: "cmip6jc1l003m2nnnbgkfv7ff",
    slug: "bring-5-friends",
    iconKey: "bring-5-friends",
    rewardCents: 1000,
    requirements: { type: "referrals", count: 5 },
    i18n: {
      // Fix round 1 (review, Important 5): "拼单" means a group-buy
      // order-splitter (Pinduoduo-style) and implies discount hunting, not
      // bringing friends. "组局达人" (someone who organizes a gathering) is
      // the mainland word for this challenge. TW "揪團高手" (rally-a-group,
      // everyday Taiwan usage) was already fine and is unchanged.
      en: { name: "Party Host", description: "Refer 5 friends who make a purchase" },
      "zh-TW": { name: "揪團高手", description: "邀請 5 位朋友完成消費" },
      "zh-CN": { name: "组局达人", description: "邀请 5 位朋友完成消费" },
      es: { name: "Anfitrión de la fiesta", description: "Invita a 5 amigos que hagan una compra" },
    },
  },
  {
    id: "cmip6jc1l003n2nnns34wpuds",
    slug: "early-bird",
    iconKey: "early-bird",
    rewardCents: 400,
    requirements: { type: "early_order", beforeHour: 11 },
    i18n: {
      en: { name: "Early Bird", description: "Order before 11am" },
      "zh-TW": { name: "早起的鳥兒", description: "上午 11 點前完成點餐" },
      "zh-CN": { name: "早起的鸟儿", description: "上午 11 点前完成点餐" },
      es: { name: "Madrugador", description: "Pide antes de las 11 a. m." },
    },
  },
];
