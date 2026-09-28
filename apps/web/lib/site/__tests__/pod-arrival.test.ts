import { describe, expect, it } from "vitest";
import { arrivalAttempts, classifyArrival, shouldForgetSaved, tryNext, type ArrivalOutcome } from "../pod-arrival";

describe("I'm here: attempt order (D6 fix round 2)", () => {
  it("a signed-in or guest-session viewer tries the session match first, the saved code only after", () => {
    expect(arrivalAttempts({ hasSession: true, saved: "ORDER-old" })).toEqual([null, "ORDER-old"]);
    expect(arrivalAttempts({ hasSession: true, saved: null })).toEqual([null]);
  });

  it("without a session, only a saved code; with neither, straight to the code form", () => {
    expect(arrivalAttempts({ hasSession: false, saved: "ORDER-1" })).toEqual(["ORDER-1"]);
    expect(arrivalAttempts({ hasSession: false, saved: null })).toEqual([]);
  });
});

describe("classifying POST /pods/confirm-arrival", () => {
  it("maps the API's answers", () => {
    expect(classifyArrival(200, { code: undefined }, null)).toBe("ok");
    expect(classifyArrival(409, { code: "ALREADY_CONFIRMED" }, null)).toBe("already");
    expect(classifyArrival(403, { code: "ORDER_CODE_REQUIRED" }, null)).toBe("needCode");
    expect(classifyArrival(409, { code: "WRONG_POD" }, "ORDER-1")).toBe("wrongPod");
    expect(classifyArrival(404, { code: "ORDER_NOT_FOUND" }, "ORDER-old")).toBe("stale");
    expect(classifyArrival(500, null, null)).toBe("failed");
    // A 404 with no code sent (the pod itself is unknown) is not a stale code.
    expect(classifyArrival(404, { code: "POD_NOT_FOUND" }, null)).toBe("failed");
    // An old sticker retired at the comb cutover: the retired-pod notice, never "failed" (G1).
    expect(classifyArrival(410, { code: "POD_RETIRED" }, null)).toBe("retired");
    expect(classifyArrival(410, { code: "POD_RETIRED" }, "ORDER-1")).toBe("retired");
    expect(tryNext("retired")).toBe(false);
  });

  it("a stale saved code from a finished order is dropped and never blocks one-tap check-in", () => {
    // Signed in, with yesterday's finished order's code saved: the session match goes first and wins.
    const attempts = arrivalAttempts({ hasSession: true, saved: "ORDER-yesterday" });
    const answers: Record<string, ArrivalOutcome> = { session: "ok", "ORDER-yesterday": "stale" };
    const first = attempts[0] === null ? answers.session : answers[attempts[0]];
    expect(first).toBe("ok");
    // Had the session missed, the stale code is tried, forgotten, and the form comes next (not an error).
    expect(tryNext("needCode")).toBe(true);
    expect(shouldForgetSaved("stale")).toBe(true);
    expect(tryNext("stale")).toBe(true);
    expect(tryNext("wrongPod")).toBe(true);
    expect(shouldForgetSaved("wrongPod")).toBe(false);
    expect(tryNext("failed")).toBe(false);
    expect(tryNext("ok")).toBe(false);
  });
});
