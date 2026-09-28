import { describe, expect, it } from "vitest";
import { countdown, momentsFor, newlyEarned, sealsSeenKey } from "../moments";

const TIERS = ["CHOPSTICK", "NOODLE_MASTER", "BEEF_BOSS"];

describe("momentsFor", () => {
  it("a fresh member gets the welcome sheet and no tier-up", () => {
    expect(momentsFor({ welcomeSeenAt: null, lastTierCelebrated: null, tier: "CHOPSTICK" }, TIERS)).toEqual({
      welcome: true,
      tierUp: null,
      recordSilently: null,
    });
  });

  it("the welcome wins even for a member who already climbed (it records their tier on finish)", () => {
    expect(momentsFor({ welcomeSeenAt: null, lastTierCelebrated: null, tier: "NOODLE_MASTER" }, TIERS).welcome).toBe(true);
    expect(momentsFor({ welcomeSeenAt: null, lastTierCelebrated: null, tier: "NOODLE_MASTER" }, TIERS).tierUp).toBe(null);
  });

  it("a tier above the last celebrated one gets the tier-up moment", () => {
    const m = momentsFor({ welcomeSeenAt: "2026-09-01T00:00:00Z", lastTierCelebrated: "CHOPSTICK", tier: "NOODLE_MASTER" }, TIERS);
    expect(m).toEqual({ welcome: false, tierUp: "NOODLE_MASTER", recordSilently: null });
  });

  it("a skipped step still celebrates the tier reached", () => {
    expect(momentsFor({ welcomeSeenAt: "x", lastTierCelebrated: "CHOPSTICK", tier: "BEEF_BOSS" }, TIERS).tierUp).toBe("BEEF_BOSS");
  });

  it("nothing when the tier was already celebrated", () => {
    expect(momentsFor({ welcomeSeenAt: "x", lastTierCelebrated: "BEEF_BOSS", tier: "BEEF_BOSS" }, TIERS)).toEqual({
      welcome: false,
      tierUp: null,
      recordSilently: null,
    });
  });

  it("the starting tier is never a tier-up: it is recorded silently", () => {
    expect(momentsFor({ welcomeSeenAt: "x", lastTierCelebrated: null, tier: "CHOPSTICK" }, TIERS)).toEqual({
      welcome: false,
      tierUp: null,
      recordSilently: "CHOPSTICK",
    });
  });

  it("a lower tier than the last celebrated (a staff correction) is recorded silently, not celebrated", () => {
    expect(momentsFor({ welcomeSeenAt: "x", lastTierCelebrated: "BEEF_BOSS", tier: "NOODLE_MASTER" }, TIERS)).toEqual({
      welcome: false,
      tierUp: null,
      recordSilently: "NOODLE_MASTER",
    });
  });

  it("a null last tier above the start celebrates (a member who climbed before the moments existed)", () => {
    expect(momentsFor({ welcomeSeenAt: "x", lastTierCelebrated: null, tier: "NOODLE_MASTER" }, TIERS).tierUp).toBe("NOODLE_MASTER");
  });
});

describe("newlyEarned", () => {
  it("is every earned seal the member hasn't seen, in earned order", () => {
    expect(newlyEarned(["first-order", "3-day-streak", "vip"], ["first-order"])).toEqual(["3-day-streak", "vip"]);
  });
  it("nothing new when all were seen", () => {
    expect(newlyEarned(["a", "b"], ["b", "a", "c"])).toEqual([]);
  });
  it("a first visit (nothing stored) stamps every earned seal", () => {
    expect(newlyEarned(["a", "b"], null)).toEqual(["a", "b"]);
  });
  it("keys the marker per member", () => {
    expect(sealsSeenKey("u1")).not.toBe(sealsSeenKey("u2"));
  });
});

describe("countdown", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("whole days left, rounded down", () => {
    expect(countdown("2026-10-08T18:00:00Z", now)).toEqual({ unit: "days", value: 10 });
  });
  it("hours in the last day, at least 1", () => {
    expect(countdown("2026-09-29T02:30:00Z", now)).toEqual({ unit: "hours", value: 14 });
    expect(countdown("2026-09-28T12:10:00Z", now)).toEqual({ unit: "hours", value: 1 });
  });
  it("ended", () => {
    expect(countdown("2026-09-28T11:00:00Z", now)).toEqual({ unit: "ended", value: 0 });
  });
});
