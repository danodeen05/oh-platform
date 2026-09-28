export const PROGRAM = {
  tiers: [
    { key: "CHOPSTICK",     cashbackPct: 1, next: "NOODLE_MASTER", need: { orders: 10, referrals: 2 }, queueBoost: 0,  earlyAccessDays: 1 },
    { key: "NOODLE_MASTER", cashbackPct: 2, next: "BEEF_BOSS",     need: { orders: 25, referrals: 5 }, queueBoost: 25, earlyAccessDays: 4 },
    { key: "BEEF_BOSS",     cashbackPct: 3, next: null,            need: null,                         queueBoost: 50, earlyAccessDays: 8 },
  ],
  upgradeReward: "FREE_BOWL", upgradeRewardWindowDays: 30,
  quarterlyPerk: { tier: "BEEF_BOSS", type: "PREMIUM_ADDON" },
  referral: { referrerCents: 500, refereeCents: 500, maxPaidPer30Days: 10 },
  creditExpiryDays: 90, expiryWarningDays: 7,
  // Task F2 fix round 1: one expiry-warning text per user per day, summing
  // every unwarned lot expiring within expiryWarningDays, sent only if that
  // total reaches this floor. Below it, the lots are still marked warned
  // (never resent), just silently - a $0.20 cashback lot alone shouldn't
  // earn its own text.
  expiryWarningMinCents: 100,
  goodwill: { perOrderCents: 500, per30DaysCents: 1000, lifetimeCents: 4500, orderAgeHours: 24 },
  timezone: "America/Denver",
};

export function tierRule(tier) {
  const rule = PROGRAM.tiers.find(t => t.key === tier);
  if (!rule) throw new Error(`Unknown tier: ${tier}`);
  return rule;
}

export function evaluateProgress(user) {
  const tier = tierRule(user.membershipTier);

  const orders = {
    have: user.tierProgressOrders || 0,
    need: tier.need ? tier.need.orders : 0,
  };

  const referrals = {
    have: user.tierProgressReferrals || 0,
    need: tier.need ? tier.need.referrals : 0,
  };

  const ready = tier.next ? (orders.have >= orders.need && referrals.have >= referrals.need) : false;

  return {
    tier: tier.key,
    next: tier.next || null,
    orders,
    referrals,
    ready,
  };
}

export function publicProgram() {
  const { goodwill, ...rest } = PROGRAM;
  return structuredClone(rest);
}
