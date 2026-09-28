import { describe, expect, it } from "vitest";
import { challengeProgress } from "../challenges";

describe("challengeProgress (Task D9 fix round 2)", () => {
  it("not enrolled is open; completed is done", () => {
    expect(challengeProgress({ type: "order_count", count: 3 }, null)).toEqual({ state: "open" });
    expect(challengeProgress({ type: "order_count", count: 3 }, { challengeId: "c", completedAt: "2026-10-01T00:00:00Z" })).toEqual({ state: "done" });
  });

  it("counts against count or target, clamped", () => {
    expect(challengeProgress({ type: "order_count", count: 3 }, { challengeId: "c", progress: { current: 2 } })).toEqual({ state: "joined", kind: "count", current: 2, target: 3 });
    expect(challengeProgress({ type: "order_streak", target: 5 }, { challengeId: "c", progress: { current: 9 } })).toMatchObject({ current: 5, target: 5 });
    expect(challengeProgress({ type: "order_count", count: 3 }, { challengeId: "c", progress: null })).toMatchObject({ current: 0 });
  });

  it("spend challenges are money; Early Bird and one-step challenges are joined once", () => {
    expect(challengeProgress({ type: "spend_amount", target: 10000 }, { challengeId: "c", progress: { current: 2500 } })).toEqual({ state: "joined", kind: "money", current: 2500, target: 10000 });
    expect(challengeProgress({ type: "early_order" }, { challengeId: "c", progress: { current: 0 } })).toEqual({ state: "joined", kind: "once" });
    expect(challengeProgress({ type: "specific_item", count: 1 }, { challengeId: "c" })).toEqual({ state: "joined", kind: "once" });
  });
});
