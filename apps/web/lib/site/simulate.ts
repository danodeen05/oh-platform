/**
 * Task D7: the path-to-Beef-Boss simulator behind the rewards page.
 *
 * An event-by-event replay of the membership engine
 * (packages/api/src/membership/engine.js), driven only by the public
 * program (GET /membership/program), so the page never hard-codes a tier
 * rule:
 *
 * - Every order: cashback at the tier held at that moment
 *   (`floor(ticket * pct / 100)`, the engine's rounding), then +1 order of
 *   progress, then the upgrade check (engine `onOrderCompleted`).
 * - Every paid referral: +1 referral of progress, then the upgrade check
 *   (engine `payReferralIfEligible`). At most `referral.maxPaidPer30Days`
 *   friends a month count: the engine only counts paid referrals and pays at
 *   most that many in any rolling 30 days.
 * - An upgrade happens the moment both needs are met: the tier moves up, a
 *   free bowl is earned, and both counts reset to zero (engine
 *   `evaluateAndApplyUpgrade`). The rest of that month's orders and
 *   referrals then count toward the next tier, and those orders earn the new
 *   tier's cashback, so two upgrades can land in one month.
 * - Progress is only tracked toward a next tier; at the top tier both
 *   counts read zero.
 *
 * Assumed order inside a month (the engine has real timestamps; the
 * simulator doesn't): the month's orders and referrals are spread evenly
 * across it. Order i of b sits at (i + 0.5) / b and referral j of f at
 * (j + 0.5) / f, and events are replayed in that order. On an exact tie the
 * order goes first (a friend's referral pays out on their own first order,
 * so it never precedes the member's order at the same instant).
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

  // Engine evaluateAndApplyUpgrade: both needs met -> next tier, free bowl, reset.
  const checkUpgrade = (month: number) => {
    const rule = tiers[index];
    if (!rule.need || !rule.next) return;
    const nextIndex = tiers.findIndex((t) => t.key === rule.next);
    if (nextIndex <= index) return;
    if (orders >= rule.need.orders && referrals >= rule.need.referrals) {
      index = nextIndex;
      orders = 0;
      referrals = 0;
      freeBowls += 1;
      const date = tierDates.find((d) => d.tier === tiers[index].key);
      if (date && date.month == null) date.month = month;
    }
  };
  const tracking = () => Boolean(tiers[index].need && tiers[index].next);

  for (let month = 1; month <= months; month++) {
    let i = 0; // orders placed this month
    let j = 0; // referrals paid this month
    while (i < bowls || j < friends) {
      const orderAt = i < bowls ? (i + 0.5) / bowls : Infinity;
      const referralAt = j < friends ? (j + 0.5) / friends : Infinity;
      if (orderAt <= referralAt) {
        cashbackCents += Math.floor((ticket * tiers[index].cashbackPct) / 100);
        if (tracking()) orders += 1;
        i += 1;
      } else {
        if (tracking()) referrals += 1;
        j += 1;
      }
      checkUpgrade(month);
    }
    timeline.push({ month, tier: tiers[index].key, orders, referrals });
  }

  return { tierDates, freeBowls, cashbackCents, timeline };
}
