/**
 * Task D7: the path-to-Beef-Boss simulator (lib/site/simulate.ts).
 *
 * Runs against the API's real program (packages/api/src/membership/program.js,
 * the same object GET /membership/program serves), so a change to the tier
 * rules shows up here first.
 *
 * Hand-computed cashback for the plan case (4 bowls a month, 1 friend a
 * month, $17.99 average, 24 months), floor(ticket * pct / 100) per order
 * like the engine:
 *   1% of 1799 = floor(17.99) = 17 cents, months 1-3 (Chopstick):   12 orders x 17 =  204
 *   2% of 1799 = floor(35.98) = 35 cents, months 4-10 (Noodle Master): 28 orders x 35 =  980
 *   3% of 1799 = floor(53.97) = 53 cents, months 11-24 (Beef Boss):  56 orders x 53 = 2968
 *   total 204 + 980 + 2968 = 4152 cents
 */
import { describe, expect, it } from "vitest";
import { publicProgram } from "../../../../../packages/api/src/membership/program.js";
import { simulate, type PublicProgram } from "../simulate";

const program = publicProgram() as PublicProgram;
const PLAN_CASE = { bowlsPerMonth: 4, friendsPerMonth: 1, avgTicketCents: 1799, months: 24 };

function monthOf(result: ReturnType<typeof simulate>, tier: string) {
  return result.tierDates.find((d) => d.tier === tier)?.month;
}

describe("simulate (plan case: 4 bowls and 1 friend a month)", () => {
  const result = simulate(program, PLAN_CASE);

  it("reaches Noodle Master in month 3 (10 orders by month 3, 2 friends by month 2)", () => {
    expect(monthOf(result, "NOODLE_MASTER")).toBe(3);
  });

  it("reaches Beef Boss in month 10 (25 orders after the month-3 reset: 4 x 7 = 28; 5 friends by month 8)", () => {
    expect(monthOf(result, "BEEF_BOSS")).toBe(10);
  });

  it("lists every tier above the first, in climb order", () => {
    expect(result.tierDates.map((d) => d.tier)).toEqual(["NOODLE_MASTER", "BEEF_BOSS"]);
  });

  it("earns one free bowl per upgrade", () => {
    expect(result.freeBowls).toBe(2);
  });

  it("earns the hand-computed cashback: 204 + 980 + 2968 = 4152 cents", () => {
    expect(result.cashbackCents).toBe(12 * 17 + 28 * 35 + 56 * 53);
    expect(result.cashbackCents).toBe(4152);
  });

  it("has one timeline entry per month, with the tier held at the end of it", () => {
    expect(result.timeline).toHaveLength(24);
    expect(result.timeline[0]).toEqual({ month: 1, tier: "CHOPSTICK", orders: 4, referrals: 1 });
    expect(result.timeline[1]).toEqual({ month: 2, tier: "CHOPSTICK", orders: 8, referrals: 2 });
    // The upgrade month resets both counts; nothing carries over.
    expect(result.timeline[2]).toEqual({ month: 3, tier: "NOODLE_MASTER", orders: 0, referrals: 0 });
    expect(result.timeline[3]).toEqual({ month: 4, tier: "NOODLE_MASTER", orders: 4, referrals: 1 });
    expect(result.timeline[8]).toEqual({ month: 9, tier: "NOODLE_MASTER", orders: 24, referrals: 6 });
    expect(result.timeline[9]).toEqual({ month: 10, tier: "BEEF_BOSS", orders: 0, referrals: 0 });
    expect(result.timeline[23].tier).toBe("BEEF_BOSS");
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

  it("reaches Beef Boss in month 2 at 30 bowls and 20 friends a month (one upgrade per month, no carry-over)", () => {
    const result = simulate(program, { bowlsPerMonth: 30, friendsPerMonth: 20, avgTicketCents: 1799, months: 6 });
    expect(monthOf(result, "NOODLE_MASTER")).toBe(1);
    expect(monthOf(result, "BEEF_BOSS")).toBe(2);
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
