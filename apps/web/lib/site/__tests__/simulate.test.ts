/**
 * Task D7: the path-to-Beef-Boss simulator (lib/site/simulate.ts).
 *
 * Runs against the API's real program (packages/api/src/membership/program.js,
 * the same object GET /membership/program serves), so a change to the tier
 * rules shows up here first.
 *
 * Fix round 1 ruling: the plan's month-10 expectation is superseded by
 * engine parity. The engine (engine.js evaluateAndApplyUpgrade, called after
 * every order and every paid referral) upgrades the moment both needs are
 * met and lets the rest of the month count toward the next tier.
 *
 * Hand-computed plan case: 4 bowls and 1 friend a month, $17.99, 24 months.
 * Within a month the events are spread evenly: orders at 1/8, 3/8, 5/8, 7/8
 * and the referral at 1/2, so each month runs O O R O O.
 *   - Month 3: the 2nd order is order 10 with 2 referrals already paid ->
 *     Noodle Master mid-month. The rest of month 3 (R O O) counts toward
 *     Beef Boss: 2 orders, 1 referral, at 2% cashback.
 *   - Progress after month m (m >= 3): 2 + 4(m - 3) orders, 1 + (m - 3) referrals.
 *     The 5th referral lands in month 7. Month 9 starts at 22 orders; its
 *     events O(23) O(24) R O(25) -> Beef Boss at the 3rd order of month 9.
 *   - Cashback per order: floor(17.99) = 17, floor(35.98) = 35, floor(53.97) = 53 cents.
 *       Chopstick:     months 1-2 (8) + month 3 (2)             = 10 orders x 17 =  170
 *       Noodle Master: month 3 (2) + months 4-8 (20) + month 9 (3) = 25 orders x 35 =  875
 *       Beef Boss:     month 9 (1) + months 10-24 (60)          = 61 orders x 53 = 3233
 *       total 170 + 875 + 3233 = 4278 cents
 *
 * Hand-computed screenshot case: 12 bowls and 3 friends a month. Orders at
 * odd 24ths, referrals at 4/24, 12/24, 20/24.
 *   - Month 1: order 10 (at 19/24) with 2 referrals paid -> Noodle Master.
 *     Then R, O, O: 2 orders, 1 referral toward Beef Boss.
 *   - Month 2 ends at 14 orders, 4 referrals. Month 3: order 25 is its 11th
 *     order (21/24), with 3 more referrals paid -> Beef Boss in month 3.
 *   - Cashback: 10 x 17 + 25 x 35 + (1 + 21 x 12) x 53 = 170 + 875 + 13409 = 14454 cents ($144).
 *
 * `replay` below is an independent check written as a different algorithm:
 * it builds the whole horizon's event list with absolute timestamps, sorts
 * it, and walks it as a state machine over the program.
 */
import { describe, expect, it } from "vitest";
import { publicProgram } from "../../../../../packages/api/src/membership/program.js";
import { simulate, type PublicProgram, type SimulateInput } from "../simulate";

const program = publicProgram() as PublicProgram;
const PLAN_CASE = { bowlsPerMonth: 4, friendsPerMonth: 1, avgTicketCents: 1799, months: 24 };

/** Independent engine replay: absolute-time event list, sorted (orders first on a tie). */
function replay(p: PublicProgram, input: SimulateInput) {
  const bowls = Math.max(0, Math.floor(input.bowlsPerMonth));
  const friends = Math.min(Math.max(0, Math.floor(input.friendsPerMonth)), p.referral.maxPaidPer30Days);
  type Ev = { t: number; kind: 0 | 1; month: number }; // kind 0 = order, 1 = referral
  const events: Ev[] = [];
  for (let m = 0; m < input.months; m++) {
    for (let i = 0; i < bowls; i++) events.push({ t: m + (i + 0.5) / bowls, kind: 0, month: m + 1 });
    for (let j = 0; j < friends; j++) events.push({ t: m + (j + 0.5) / friends, kind: 1, month: m + 1 });
  }
  events.sort((a, b) => a.t - b.t || a.kind - b.kind);
  let tier = p.tiers[0];
  let o = 0;
  let r = 0;
  let cents = 0;
  const reached: Record<string, number> = {};
  for (const e of events) {
    if (e.kind === 0) {
      cents += Math.floor((input.avgTicketCents * tier.cashbackPct) / 100);
      o++;
    } else r++;
    if (tier.need && tier.next && o >= tier.need.orders && r >= tier.need.referrals) {
      tier = p.tiers.find((t) => t.key === tier.next)!;
      reached[tier.key] = e.month;
      o = 0;
      r = 0;
    }
  }
  return { reached, cents, upgrades: Object.keys(reached).length };
}

function monthOf(result: ReturnType<typeof simulate>, tier: string) {
  return result.tierDates.find((d) => d.tier === tier)?.month;
}

describe("simulate (plan case: 4 bowls and 1 friend a month)", () => {
  const result = simulate(program, PLAN_CASE);

  it("reaches Noodle Master in month 3 (order 10 lands mid-month, with 2 friends paid)", () => {
    expect(monthOf(result, "NOODLE_MASTER")).toBe(3);
  });

  it("reaches Beef Boss in month 9, not 10: the rest of month 3 counts toward it (engine parity)", () => {
    expect(monthOf(result, "BEEF_BOSS")).toBe(9);
  });

  it("lists every tier above the first, in climb order", () => {
    expect(result.tierDates.map((d) => d.tier)).toEqual(["NOODLE_MASTER", "BEEF_BOSS"]);
  });

  it("earns one free bowl per upgrade", () => {
    expect(result.freeBowls).toBe(2);
  });

  it("earns the hand-computed cashback: 170 + 875 + 3233 = 4278 cents", () => {
    expect(result.cashbackCents).toBe(10 * 17 + 25 * 35 + 61 * 53);
    expect(result.cashbackCents).toBe(4278);
  });

  it("matches the independent replay", () => {
    const r = replay(program, PLAN_CASE);
    expect(r).toEqual({ reached: { NOODLE_MASTER: 3, BEEF_BOSS: 9 }, cents: 4278, upgrades: 2 });
  });

  it("has one timeline entry per month: the tier at its end and the progress after any reset", () => {
    expect(result.timeline).toHaveLength(24);
    expect(result.timeline[0]).toEqual({ month: 1, tier: "CHOPSTICK", orders: 4, referrals: 1 });
    expect(result.timeline[1]).toEqual({ month: 2, tier: "CHOPSTICK", orders: 8, referrals: 2 });
    // Upgraded mid-month 3; R O O after it count toward Beef Boss.
    expect(result.timeline[2]).toEqual({ month: 3, tier: "NOODLE_MASTER", orders: 2, referrals: 1 });
    expect(result.timeline[7]).toEqual({ month: 8, tier: "NOODLE_MASTER", orders: 22, referrals: 6 });
    // Top tier: nothing left to track.
    expect(result.timeline[8]).toEqual({ month: 9, tier: "BEEF_BOSS", orders: 0, referrals: 0 });
    expect(result.timeline[23].tier).toBe("BEEF_BOSS");
  });
});

describe("simulate (screenshot case: 12 bowls and 3 friends a month)", () => {
  const input = { bowlsPerMonth: 12, friendsPerMonth: 3, avgTicketCents: 1799, months: 24 };
  const result = simulate(program, input);

  it("reaches Noodle Master in month 1 and Beef Boss in month 3, with 14454 cents ($144) cashback", () => {
    expect(monthOf(result, "NOODLE_MASTER")).toBe(1);
    expect(monthOf(result, "BEEF_BOSS")).toBe(3);
    expect(result.cashbackCents).toBe(10 * 17 + 25 * 35 + 253 * 53);
    expect(result.cashbackCents).toBe(14454);
  });

  it("matches the independent replay", () => {
    expect(replay(program, input)).toEqual({ reached: { NOODLE_MASTER: 1, BEEF_BOSS: 3 }, cents: 14454, upgrades: 2 });
  });
});

describe("simulate agrees with the independent replay across the slider grid", () => {
  it("every bowls 0-20 x friends 0-10 pace, at two tickets, 24 months", () => {
    for (const ticket of [999, 1799, 3999]) {
      for (let b = 0; b <= 20; b++) {
        for (let f = 0; f <= 10; f++) {
          const input = { bowlsPerMonth: b, friendsPerMonth: f, avgTicketCents: ticket, months: 24 };
          const s = simulate(program, input);
          const r = replay(program, input);
          const reached = Object.fromEntries(s.tierDates.filter((d) => d.month != null).map((d) => [d.tier, d.month]));
          expect({ reached, cents: s.cashbackCents, upgrades: s.freeBowls }, `b=${b} f=${f} t=${ticket}`).toEqual(r);
        }
      }
    }
  });
});

describe("simulate: no friends means no upgrade", () => {
  const result = simulate(program, { ...PLAN_CASE, friendsPerMonth: 0 });

  it("never upgrades, and every date is null", () => {
    expect(result.tierDates).toEqual([
      { tier: "NOODLE_MASTER", month: null },
      { tier: "BEEF_BOSS", month: null },
    ]);
    expect(result.freeBowls).toBe(0);
    expect(result.timeline.every((m) => m.tier === "CHOPSTICK")).toBe(true);
  });

  it("still earns first-tier cashback on every order", () => {
    expect(result.cashbackCents).toBe(24 * 4 * 17);
  });
});

describe("simulate: the referral cap", () => {
  it("counts at most maxPaidPer30Days friends a month (20 a month counts as 10)", () => {
    const result = simulate(program, { bowlsPerMonth: 4, friendsPerMonth: 20, avgTicketCents: 1799, months: 2 });
    expect(program.referral.maxPaidPer30Days).toBe(10);
    expect(result.timeline[0].referrals).toBe(10);
    expect(result.timeline[1].referrals).toBe(20);
  });

  it("delays an upgrade that the cap makes unreachable in one month", () => {
    // A program whose first step needs 15 friends: 20 a month is capped to 10,
    // so it takes two months, not one.
    const strict: PublicProgram = structuredClone(program);
    strict.tiers[0].need = { orders: 10, referrals: 15 };
    const result = simulate(strict, { bowlsPerMonth: 30, friendsPerMonth: 20, avgTicketCents: 1799, months: 6 });
    expect(monthOf(result, "NOODLE_MASTER")).toBe(2);
  });

  it("30 bowls and 20 friends: Noodle Master in month 1, Beef Boss in month 2", () => {
    const result = simulate(program, { bowlsPerMonth: 30, friendsPerMonth: 20, avgTicketCents: 1799, months: 6 });
    expect(monthOf(result, "NOODLE_MASTER")).toBe(1);
    expect(monthOf(result, "BEEF_BOSS")).toBe(2);
    expect(result.freeBowls).toBe(2);
  });

  it("can upgrade twice in one month when the pace allows (40 bowls, 10 friends)", () => {
    const result = simulate(program, { bowlsPerMonth: 40, friendsPerMonth: 10, avgTicketCents: 1799, months: 1 });
    expect(monthOf(result, "NOODLE_MASTER")).toBe(1);
    expect(monthOf(result, "BEEF_BOSS")).toBe(1);
    expect(result.freeBowls).toBe(2);
  });
});

describe("simulate: edges", () => {
  it("leaves a date null when it falls past the horizon", () => {
    const result = simulate(program, { ...PLAN_CASE, months: 6 });
    expect(monthOf(result, "NOODLE_MASTER")).toBe(3);
    expect(monthOf(result, "BEEF_BOSS")).toBeNull();
    expect(result.freeBowls).toBe(1);
  });

  it("treats zero bowls as no progress and no cashback", () => {
    const result = simulate(program, { ...PLAN_CASE, bowlsPerMonth: 0 });
    expect(result.cashbackCents).toBe(0);
    expect(result.tierDates.every((d) => d.month === null)).toBe(true);
  });

  it("clamps negative and fractional inputs to whole, non-negative counts", () => {
    const result = simulate(program, { bowlsPerMonth: 4.7, friendsPerMonth: -3, avgTicketCents: 1799.9, months: 2 });
    expect(result.timeline[0]).toEqual({ month: 1, tier: "CHOPSTICK", orders: 4, referrals: 0 });
    expect(result.cashbackCents).toBe(8 * 17);
  });
});
