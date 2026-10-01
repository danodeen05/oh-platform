import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { arrivalClock, formatCents, ORDER_ERROR_CODES, orderErrorCode, QUOTE_WARNINGS, stripeLocale } from "../order-flow";
import { isEventPath, isOrderBuildPath } from "../order-routes";
import { podWalkSteps } from "../pod-walk";

describe("isOrderBuildPath (the dock hides, Back shows)", () => {
  it.each(["/en/order", "/zh-TW/order/location/abc", "/es/order/location/abc?step=pod", "/en/order/payment", "/order"])("%s is the order flow", (p) => {
    expect(isOrderBuildPath(p)).toBe(true);
  });
  it.each(["/en", "/en/menu", "/en/order/status", "/en/order/confirmation", "/en/order/check-in", "/en/orders", null])("%s is not", (p) => {
    expect(isOrderBuildPath(p)).toBe(false);
  });
});

describe("isEventPath (private events: no dock, no active-order pill)", () => {
  it.each(["/en/e/acme-oct5", "/zh-TW/e/acme-oct5/rsvp", "/es/e/acme-oct5/status?qrCode=X", "/e/acme-oct5"])("%s is an event page", (p) => {
    expect(isEventPath(p)).toBe(true);
  });
  it.each(["/en", "/en/e", "/en/experience", "/en/order", "/en/events/x", null])("%s is not", (p) => {
    expect(isEventPath(p)).toBe(false);
  });
});

describe("orderErrorCode", () => {
  it("keeps known codes, maps a bare 403 to FORBIDDEN and the rest to GENERIC", () => {
    expect(orderErrorCode("POD_UNAVAILABLE")).toBe("POD_UNAVAILABLE");
    expect(orderErrorCode("DINE_IN_DISABLED", 403)).toBe("DINE_IN_DISABLED");
    expect(orderErrorCode(null, 403)).toBe("FORBIDDEN");
    expect(orderErrorCode("SOMETHING_NEW", 500)).toBe("GENERIC");
  });

  it("every code and warning has a message in all four locales, with no em dashes", () => {
    const dir = path.resolve(__dirname, "../../../messages");
    const keySets: string[] = [];
    for (const loc of ["en", "es", "zh-TW", "zh-CN"]) {
      const m = JSON.parse(readFileSync(path.join(dir, `${loc}.json`), "utf8")).orderFlow;
      expect(m, `${loc} has orderFlow`).toBeTruthy();
      for (const c of ORDER_ERROR_CODES) expect(typeof m.errors[c], `${loc} errors.${c}`).toBe("string");
      for (const w of QUOTE_WARNINGS) expect(typeof m.warnings[w], `${loc} warnings.${w}`).toBe("string");
      const flat = JSON.stringify(m);
      expect(flat.includes("—"), `${loc}: no em dash`).toBe(false);
      keySets.push(JSON.stringify(keysOf(m)));
    }
    expect(new Set(keySets).size, "identical key sets").toBe(1);
  });
});

function keysOf(o: unknown, prefix = ""): string[] {
  if (!o || typeof o !== "object" || Array.isArray(o)) return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k)).sort();
}

describe("podWalkSteps", () => {
  it("counts the real path from the entry in strides, nearest pod fewest", () => {
    // bestRank 1 at City Creek is C-25; the far corner is A-01.
    const near = podWalkSteps("comb-75", "C-25");
    const far = podWalkSteps("comb-75", "A-01");
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near!);
    // The building is 70 x 50 ft: no walk is longer than its perimeter.
    expect(far! * 2.5).toBeLessThan(240);
    expect(podWalkSteps("comb-70-mirrored", "B-07")).toBeGreaterThan(0);
  });

  it("is null (no number shown) for an unknown layout or pod", () => {
    expect(podWalkSteps(null, "B-07")).toBeNull();
    expect(podWalkSteps("comb-75", "Z-99")).toBeNull();
    expect(podWalkSteps("legacy", "B-07")).toBeNull();
  });
});

describe("display helpers", () => {
  it("formats dollars with a plain $ in every locale", () => {
    expect(formatCents(1749, "en")).toBe("$17.49");
    expect(formatCents(1749, "zh-TW")).toBe("$17.49");
    expect(formatCents(0, "zh-CN")).toBe("$0.00");
    expect(formatCents(1749, "es")).toMatch(/17[.,]49/);
  });

  it("maps site locales to Stripe's", () => {
    expect(stripeLocale("zh-TW")).toBe("zh-TW");
    expect(stripeLocale("zh-CN")).toBe("zh");
    expect(stripeLocale("es")).toBe("es");
    expect(stripeLocale("en")).toBe("en");
  });

  it("shows arrival clock times in the location's zone (America/Denver, DST fall-back day)", () => {
    // 2026-11-01 07:30 UTC is 01:30 MDT; 60 minutes later is 01:30 MST (the repeated hour).
    const now = new Date("2026-11-01T07:30:00Z");
    expect(arrivalClock(0, "en-US", "America/Denver", now)).toBe("1:30 AM");
    expect(arrivalClock(60, "en-US", "America/Denver", now)).toBe("1:30 AM");
    expect(arrivalClock(90, "en-US", "America/Denver", now)).toBe("2:00 AM");
  });
});
