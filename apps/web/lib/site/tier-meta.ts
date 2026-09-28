/**
 * Task D7: how a membership program tier key maps to the owner's tier art
 * (TierMark) and the canonical `loyalty.tiers.*` message names. Client-safe:
 * no fetch or server code, so client islands import this rather than
 * lib/site/program.ts.
 */
export const TIER_META = {
  CHOPSTICK: { mark: "chopstick", msg: "chopstick" },
  NOODLE_MASTER: { mark: "noodle-master", msg: "noodleMaster" },
  BEEF_BOSS: { mark: "beef-boss", msg: "beefBoss" },
} as const;

export type TierKey = keyof typeof TIER_META;

export function tierMeta(key: string) {
  return TIER_META[key as TierKey] ?? TIER_META.CHOPSTICK;
}
