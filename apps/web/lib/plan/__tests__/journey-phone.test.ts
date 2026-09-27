import { describe, expect, it } from "vitest";
import { ANIMATED_STEPS, JOURNEY_STEPS, PHONE_STAGES, statusStageAt } from "@/components/plan/modules/floor-plan/layout";

describe("the guest's phone in the order journey", () => {
  it("adds the status-page beats, flagged as phone moments, in order", () => {
    const keys = JOURNEY_STEPS.map((s) => s.key);
    for (const k of ["texted", "checkin", "feed", "fortune", "addon", "done"] as const) expect(keys).toContain(k);
    const phone = JOURNEY_STEPS.filter((s) => s.phone).map((s) => s.key);
    expect(phone).toEqual(["texted", "checkin", "feed", "fortune", "addon", "done"]);
    expect(keys.indexOf("texted")).toBeLessThan(keys.indexOf("assigned"));
    expect(keys.indexOf("checkin")).toBe(keys.indexOf("seated") + 1);
    expect(keys.indexOf("addon")).toBeGreaterThan(keys.indexOf("delivered"));
    expect(keys.indexOf("done")).toBeLessThan(keys.indexOf("exit"));
    expect(ANIMATED_STEPS.every((s) => s.at !== null)).toBe(true);
  });

  it("maps journey progress to the status page stage the guest sees", () => {
    expect(statusStageAt(0)).toBe("PAID");
    expect(statusStageAt(0.19)).toBe("PAID");
    expect(statusStageAt(0.2)).toBe("QUEUED");
    expect(statusStageAt(0.3)).toBe("PREPPING");
    expect(statusStageAt(0.66)).toBe("READY");
    expect(statusStageAt(0.78)).toBe("SERVING");
    expect(statusStageAt(0.9)).toBe("COMPLETED");
    expect(statusStageAt(1)).toBe("COMPLETED");
    const seen = new Set<string>();
    for (let p = 0; p <= 1.0001; p += 0.01) seen.add(statusStageAt(p));
    expect([...seen]).toEqual([...PHONE_STAGES]);
  });
});
