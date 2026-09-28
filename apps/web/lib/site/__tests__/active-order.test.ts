import { describe, expect, test } from "vitest";
import { activeOrderStatusKey, isOrderFlowPath } from "../active-order";

// Task C4: the shared active-order logic behind both the legacy
// ActiveOrderBanner and the site shell's ActiveOrderPill.

describe("isOrderFlowPath", () => {
  test.each([
    "/en/order/status",
    "/zh-TW/order/confirmation",
    "/es/order/scan",
    "/en/order/check-in",
    "/en/pod/12",
  ])("%s hides the active order prompt", (p) => {
    expect(isOrderFlowPath(p)).toBe(true);
  });

  test.each(["/en", "/en/menu", "/en/order", "/zh-CN/lab/shell"])("%s shows it", (p) => {
    expect(isOrderFlowPath(p)).toBe(false);
  });

  test("a null pathname is not an order page", () => {
    expect(isOrderFlowPath(null)).toBe(false);
  });
});

describe("activeOrderStatusKey", () => {
  test("maps order statuses to translation keys", () => {
    expect(activeOrderStatusKey({ status: "PAID", podNumber: null })).toBe("placed");
    expect(activeOrderStatusKey({ status: "QUEUED", podNumber: null })).toBe("inQueue");
    expect(activeOrderStatusKey({ status: "QUEUED", podNumber: "12" })).toBe("checkedIn");
    expect(activeOrderStatusKey({ status: "PREPPING", podNumber: "12" })).toBe("preparing");
    expect(activeOrderStatusKey({ status: "READY", podNumber: "12" })).toBe("ready");
    expect(activeOrderStatusKey({ status: "SERVING", podNumber: "12" })).toBe("serving");
  });

  test("an unknown status falls back to a generic key, never the raw enum", () => {
    expect(activeOrderStatusKey({ status: "SOMETHING_NEW", podNumber: null })).toBe("active");
  });
});
