/**
 * Task D7: the path-to-Beef-Boss simulator behind the rewards page.
 *
 * A month-by-month model of the membership engine
 * (packages/api/src/membership/engine.js), driven only by the public
 * program (GET /membership/program), so the page never hard-codes a tier
 * rule:
 *
 * - Each month adds `bowlsPerMonth` orders and `friendsPerMonth` referrals
 *   to the progress toward the next tier. Referrals are capped at the
 *   program's `referral.maxPaidPer30Days` a month: the engine only counts a
 *   referral toward the tier when it is paid, and it pays at most that many
 *   in any rolling 30 days.
 * - A month that ends with both needs met is an upgrade month: the tier
 *   moves up, a free bowl is earned, and both counts reset to zero. Anything
 *   beyond the requirement does not carry over (the engine writes
 *   `tierProgressOrders: 0, tierProgressReferrals: 0`), so at most one
 *   upgrade happens per month.
 * - Cashback is `floor(ticket * pct / 100)` per order, the engine's own
 *   rounding, at the tier held when the month starts.
 *
 * Pure: no I/O, safe on the server and in the browser.
 */

export interface ProgramTier {
  key: string;
  cashbackPct: number;
  next: string | null;
  need: { orders: number; referrals: number } | null;
  queueBoost: number;
  earlyAccessDays: number;
}

/** The shape of publicProgram() in packages/api/src/membership/program.js. */
export interface PublicProgram {
  tiers: ProgramTier[];
  upgradeReward: string;
  upgradeRewardWindowDays: number;
  quarterlyPerk: { tier: string; type: string } | null;
  referral: { referrerCents: number; refereeCents: number; maxPaidPer30Days: number };
  creditExpiryDays: number;
  expiryWarningDays?: number;
  timezone: string;
}

export interface SimulateInput {
  bowlsPerMonth: number;
  friendsPerMonth: number;
  avgTicketCents: number;
  months: number;
}

export interface SimulateResult {
  /** One entry per tier above the first, in climb order; `month` is null when it isn't reached in the horizon. */
  tierDates: { tier: string; month: number | null }[];
  freeBowls: number;
  cashbackCents: number;
  /** One entry per month: the tier held at its end, and the progress toward the next tier after any reset. */
  timeline: { month: number; tier: string; orders: number; referrals: number }[];
}

function wholeNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function simulate(program: PublicProgram, input: SimulateInput): SimulateResult {
  const tiers = program.tiers;
  const bowls = wholeNonNegative(input.bowlsPerMonth);
  const friends = Math.min(wholeNonNegative(input.friendsPerMonth), wholeNonNegative(program.referral.maxPaidPer30Days));
  const ticket = wholeNonNegative(input.avgTicketCents);
  const months = wholeNonNegative(input.months);

  const tierDates: SimulateResult["tierDates"] = tiers.slice(1).map((t) => ({ tier: t.key, month: null }));
  const timeline: SimulateResult["timeline"] = [];
  let index = 0;
  let orders = 0;
  let referrals = 0;
  let freeBowls = 0;
  let cashbackCents = 0;

  for (let month = 1; month <= months; month++) {
    const rule = tiers[index];
    cashbackCents += bowls * Math.floor((ticket * rule.cashbackPct) / 100);

    const nextIndex = rule.next ? tiers.findIndex((t) => t.key === rule.next) : -1;
    if (rule.need && nextIndex > index) {
      orders += bowls;
      referrals += friends;
      if (orders >= rule.need.orders && referrals >= rule.need.referrals) {
        index = nextIndex;
        orders = 0;
        referrals = 0;
        freeBowls += 1;
        const date = tierDates.find((d) => d.tier === tiers[index].key);
        if (date) date.month = month;
      }
    }

    timeline.push({ month, tier: tiers[index].key, orders, referrals });
  }

  return { tierDates, freeBowls, cashbackCents, timeline };
}
