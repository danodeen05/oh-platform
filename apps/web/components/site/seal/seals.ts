/**
 * Chop seal (印章) glyph map for badges (Task C2). Keyed by `Badge.slug`
 * (packages/db/prisma/schema.prisma) -- the slugs come from
 * packages/db/prisma/seed-prod.ts (~lines 260-275) and packages/db/prisma/
 * seed.ts, where they're paired with an `iconEmoji` today. Those emoji are
 * being replaced by `Badge.iconKey` + this in-house glyph map (see the
 * no-emoji guard in apps/web/lib/site/__tests__/no-emoji.test.ts); the DB
 * itself (`oh_overhaul_assets`) has no rows yet in this worktree.
 *
 * The glyph is rendered `aria-hidden` by <Seal>; the accessible name is
 * always the translated badge name, passed in as a prop.
 *
 * Border escalates with the badge's rank inside its category (square for
 * the first rung, round for the middle rung, double for the top rung),
 * except the two SPECIAL badges, which both get the double frame.
 */

export interface SealDef {
  /** A single CJK glyph. aria-hidden -- never the accessible name. */
  glyph: string;
  border: "square" | "round" | "double";
}

export const SEALS: Record<string, SealDef> = {
  // MILESTONE (order count)
  "first-order": { glyph: "初", border: "square" }, // "first"
  "10-orders": { glyph: "麵", border: "round" }, // "noodles"
  "50-orders": { glyph: "迷", border: "round" }, // "devotee/fan"
  "100-orders": { glyph: "百", border: "double" }, // "hundred"

  // REFERRAL
  "first-referral": { glyph: "友", border: "square" }, // "friend"
  "10-referrals": { glyph: "星", border: "round" }, // "star"
  "50-referrals": { glyph: "尊", border: "double" }, // "honored"

  // STREAK
  "3-day-streak": { glyph: "連", border: "square" }, // "consecutive"
  "7-day-streak": { glyph: "週", border: "round" }, // "week"
  "30-day-streak": { glyph: "傳", border: "double" }, // "legend"

  // CHALLENGE
  "tried-all-items": { glyph: "全", border: "round" }, // "complete"
  "spicy-challenge": { glyph: "辣", border: "round" }, // "spicy"
  // Dev-seed-only challenges (packages/db/prisma/seed.ts), kept for parity.
  "try-all-bases": { glyph: "探", border: "round" }, // "explore"
  "bring-5-friends": { glyph: "宴", border: "round" }, // "banquet/party"
  "early-bird": { glyph: "晨", border: "round" }, // "morning"

  // SPECIAL
  "grand-opening": { glyph: "元", border: "double" }, // "founding"
  vip: { glyph: "牛", border: "double" }, // "beef/VIP"

  // MENU (Task D3): an item a member sees before its release date.
  "early-access": { glyph: "先", border: "round" }, // "first/ahead"
};

/** Used for a badge slug not (yet) present in SEALS. */
export const DEFAULT_SEAL: SealDef = { glyph: "印", border: "square" }; // "seal/stamp"
