import { describe, expect, it } from "vitest";
import { PHONE_STAGES } from "@oh/floor-plan";
import {
  DEMO_NEXT,
  demoCodeFor,
  demoStageFromMessage,
  formatClock,
  initialDemoStage,
  isDemoCode,
  podLabelOf,
  podMoved,
  progress,
  stageIndex,
  statusPath,
  timeline,
  visitMinutes,
} from "../order-status";

describe("the plan's status demo contract", () => {
  it("uses the floor plan's phone stages", () => {
    expect(PHONE_STAGES).toEqual(["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"]);
    expect(Object.keys(DEMO_NEXT)).toEqual([...PHONE_STAGES]);
  });

  it("DEMO- codes are the demo, real codes are not", () => {
    expect(isDemoCode("DEMO-PLAN")).toBe(true);
    expect(isDemoCode("DEMO-PLAN.PREPPING")).toBe(true);
    expect(isDemoCode("ORDER-xxpmm5hf-1-ABC")).toBe(false);
    expect(isDemoCode(null)).toBe(false);
  });

  it("the first stage is pinned in the code, then ?demoStage=, then PAID", () => {
    expect(initialDemoStage("DEMO-PLAN.PREPPING")).toBe("PREPPING");
    expect(initialDemoStage("DEMO-PLAN.PREPPING", "READY")).toBe("PREPPING");
    expect(initialDemoStage("DEMO-PLAN", "READY")).toBe("READY");
    expect(initialDemoStage("DEMO-PLAN", "BOGUS")).toBe("PAID");
    expect(initialDemoStage("DEMO-PLAN.BOGUS")).toBe("PAID");
    expect(demoCodeFor("DEMO-PLAN.PREPPING", "READY")).toBe("DEMO-PLAN.READY");
    expect(demoCodeFor("DEMO-PLAN", "SERVING")).toBe("DEMO-PLAN.SERVING");
  });

  it("follows only { type: 'oh-status-demo', stage } messages with a real stage", () => {
    expect(demoStageFromMessage({ type: "oh-status-demo", stage: "READY" })).toBe("READY");
    expect(demoStageFromMessage({ type: "oh-status-demo", stage: "CANCELLED" })).toBeNull();
    expect(demoStageFromMessage({ type: "other", stage: "READY" })).toBeNull();
    expect(demoStageFromMessage("READY")).toBeNull();
    expect(demoStageFromMessage(null)).toBeNull();
  });

  it("plays by itself up to SERVING and waits there", () => {
    expect(DEMO_NEXT.PAID).toBe("QUEUED");
    expect(DEMO_NEXT.SERVING).toBeNull();
  });
});

describe("timeline", () => {
  const times = {
    paidAt: "2026-09-28T18:00:00Z",
    arrivedAt: "2026-09-28T18:10:00Z",
    prepStartTime: "2026-09-28T18:11:00Z",
    readyTime: null,
  };

  it("marks done, current and upcoming, with times only for reached stages", () => {
    const steps = timeline("PREPPING", times);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[1].at).toBe("2026-09-28T18:10:00Z");
    expect(steps[3].at).toBeNull();
  });

  it("a completed visit is all done; an unpaid order is all upcoming", () => {
    expect(timeline("COMPLETED").every((s) => s.state === "done")).toBe(true);
    expect(timeline("PENDING_PAYMENT").every((s) => s.state === "upcoming")).toBe(true);
    expect(stageIndex("CANCELLED")).toBe(-1);
    expect(progress("PAID")).toBeCloseTo(1 / 6);
    expect(progress("COMPLETED")).toBe(1);
    expect(progress("PENDING_PAYMENT")).toBe(0);
  });

  it("clock times are in the location's zone and the page's language", () => {
    expect(formatClock("2026-09-28T18:04:00Z", "en", "America/Denver")).toBe("12:04 PM");
    expect(formatClock("2026-09-28T18:04:00Z", "zh-TW", "America/Denver")).toMatch(/12:04/);
    // The DST fall-back day: 08:30Z is 1:30 AM MST after the change (MDT would be 2:30).
    expect(formatClock("2026-11-01T08:30:00Z", "en", "America/Denver")).toBe("1:30 AM");
    expect(formatClock(null, "en")).toBeNull();
    expect(formatClock("nope", "en")).toBeNull();
  });

  it("visit minutes run from payment to the bowl reaching the pod", () => {
    expect(visitMinutes({ paidAt: "2026-09-28T18:00:00Z", deliveredAt: "2026-09-28T18:17:20Z" })).toBe(17);
    expect(visitMinutes({ paidAt: "2026-09-28T18:00:00Z" })).toBeNull();
  });
});

describe("pods", () => {
  it("shows the comb label, else the seat number (the demo's pod 32)", () => {
    expect(podLabelOf({ podLabel: "B-07", podNumber: "B-07" })).toBe("B-07");
    expect(podLabelOf({ podLabel: null, podNumber: "32" })).toBe("32");
    expect(podLabelOf(null)).toBeNull();
  });

  it("a pod moved at payment is announced once it differs (D12)", () => {
    expect(podMoved("A-03", "B-07")).toEqual({ from: "A-03", to: "B-07" });
    expect(podMoved("B-07", "B-07")).toBeNull();
    expect(podMoved(null, "B-07")).toBeNull();
    expect(podMoved("A-03", null)).toBeNull();
  });

  it("the pay step's status link carries the change", () => {
    expect(statusPath("en", "ORDER-1")).toBe("/en/order/status?orderQrCode=ORDER-1");
    expect(statusPath("zh-TW", "ORDER-1", { changed: true, from: "A-03", to: "B-07" })).toBe("/zh-TW/order/status?orderQrCode=ORDER-1&podFrom=A-03");
    expect(statusPath("es", "ORDER-1", { changed: true, noPod: true, from: "A-03", to: null })).toBe("/es/order/status?orderQrCode=ORDER-1&podFrom=A-03&podNone=1");
  });
});
