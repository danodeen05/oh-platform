/**
 * Task D8: the passport's one-time moments, as pure functions (unit-tested
 * in __tests__/moments.test.ts).
 *
 * - The welcome sheet shows while `welcomeSeenAt` is null. Finishing it
 *   records the welcome AND the member's current tier as celebrated, so a
 *   member never sees a "tier-up" for a tier they already held when they
 *   first opened the passport.
 * - The tier-up moment shows when the tier is above the last celebrated one
 *   (the program's tier order). The starting tier, or a lower tier after a
 *   staff correction, is never a celebration: it is recorded silently so
 *   the flags agree again.
 */

export interface MomentFlags {
  welcomeSeenAt: string | null;
  lastTierCelebrated: string | null;
  tier: string;
}

export interface Moments {
  welcome: boolean;
  /** The tier to celebrate, or null. */
  tierUp: string | null;
  /** A tier to record without a moment (POST tierCelebrated quietly), or null. */
  recordSilently: string | null;
}

/** `tierOrder`: the program's tier keys, lowest first. */
export function momentsFor(flags: MomentFlags, tierOrder: readonly string[]): Moments {
  if (!flags.welcomeSeenAt) return { welcome: true, tierUp: null, recordSilently: null };
  if (flags.lastTierCelebrated === flags.tier) return { welcome: false, tierUp: null, recordSilently: null };
  const at = tierOrder.indexOf(flags.tier);
  const last = flags.lastTierCelebrated ? tierOrder.indexOf(flags.lastTierCelebrated) : 0;
  if (at > last) return { welcome: false, tierUp: flags.tier, recordSilently: null };
  return { welcome: false, tierUp: null, recordSilently: flags.tier };
}

/** Earned seal slugs not in `seen` (null: nothing stored yet, so all of them). */
export function newlyEarned(earned: readonly string[], seen: readonly string[] | null): string[] {
  if (!seen) return [...earned];
  const s = new Set(seen);
  return earned.filter((slug) => !s.has(slug));
}

/** localStorage key for the seals a member has seen stamped. */
export function sealsSeenKey(userId: string): string {
  return `oh-passport-seals-seen:${userId}`;
}

export type Countdown = { unit: "days" | "hours" | "ended"; value: number };

/** Time left until `endsAt`: whole days, or hours (at least 1) in the last day. */
export function countdown(endsAt: string | Date, now: Date = new Date()): Countdown {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return { unit: "ended", value: 0 };
  const days = Math.floor(ms / 864e5);
  if (days >= 1) return { unit: "days", value: days };
  return { unit: "hours", value: Math.max(1, Math.floor(ms / 36e5)) };
}
