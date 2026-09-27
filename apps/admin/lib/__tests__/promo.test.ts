import { expect, test } from "vitest";
import { formFromPromo, hasTargeting, isExpired, promoBody, statusLabel, topCodes, usageByScope, usageText, validatePromo, formatDiscount } from "../promo";
const f = { code: "fall", discountType: "PERCENTAGE", discountValue: "15", scope: "ALL", perUserLimit: "1", targetCategories: [], targetProductIds: [], excludedProductIds: [], locationIds: [] } as never;
test("free shipping needs no value (old bug)", () => expect(validatePromo({ ...f, discountType: "FREE_SHIPPING", discountValue: "" })).toEqual({}));
test("value required and positive otherwise", () => expect(validatePromo({ ...f, discountValue: "0" }).discountValue).toBeTruthy());
test("per-bowl only with catering scope", () => expect(validatePromo({ ...f, discountType: "FIXED_PER_BOWL" }).discountType).toBeTruthy());
test("body uppercases code and sends empty arrays as null", () => {
  const b = promoBody(f);
  expect(b.code).toBe("FALL"); expect(b.targetCategories).toBeNull(); expect(b.perUserLimit).toBe(1);
});
test("formatDiscount", () => {
  expect(formatDiscount({ discountType: "PERCENTAGE", discountValue: 15, maxDiscountCents: 500 })).toBe("15% (max $5.00)");
  expect(formatDiscount({ discountType: "FIXED_PER_BOWL", discountValue: 200 })).toBe("$2.00 per bowl");
  expect(formatDiscount({ discountType: "FREE_SHIPPING", discountValue: 0 })).toBe("Free shipping");
  expect(formatDiscount({ discountType: "FIXED_AMOUNT", discountValue: 1000 })).toBe("$10.00");
});

test("usageText: limit or infinity", () => {
  expect(usageText({ currentUsageCount: 3, totalUsageLimit: 10 })).toBe("3/10");
  expect(usageText({ currentUsageCount: 3, totalUsageLimit: null })).toBe("3/∞");
});

test("statusLabel: expired beats active", () => {
  const now = new Date("2026-09-27T20:00:00Z");
  expect(statusLabel({ isActive: true, expiresAt: "2026-01-01T00:00:00Z" }, now)).toBe("Expired");
  expect(statusLabel({ isActive: true, expiresAt: null }, now)).toBe("Active");
  expect(statusLabel({ isActive: false, expiresAt: null }, now)).toBe("Inactive");
  expect(isExpired({ expiresAt: null }, now)).toBe(false);
});

test("hasTargeting", () => {
  expect(hasTargeting({ targetCategories: [], targetProductIds: [], excludedProductIds: [], locationIds: [] })).toBe(false);
  expect(hasTargeting({ targetCategories: ["FOOD"], targetProductIds: [], excludedProductIds: [], locationIds: [] })).toBe(true);
});

test("formFromPromo: null gives an empty form with defaults", () => {
  const f = formFromPromo(null);
  expect(f.discountType).toBe("PERCENTAGE");
  expect(f.perUserLimit).toBe("1");
  expect(f.targetCategories).toEqual([]);
});

test("formFromPromo: percentage stays a plain number, money types become dollars", () => {
  const p = { id: "1", code: "FALL", discountType: "PERCENTAGE", discountValue: 15, maxDiscountCents: 500, scope: "ALL",
    totalUsageLimit: null, perUserLimit: 2, currentUsageCount: 0, minimumOrderCents: 1000, startsAt: "2026-01-01T00:00:00Z",
    expiresAt: "2026-12-31T00:00:00Z", isActive: true, description: null,
    targetCategories: [], targetProductIds: [], excludedProductIds: [], locationIds: [] } as const;
  const f = formFromPromo(p as never);
  expect(f.discountValue).toBe("15");
  expect(f.maxDiscountCents).toBe("5.00");
  expect(f.minimumOrderCents).toBe("10.00");
  expect(f.perUserLimit).toBe("2");
});

test("usageByScope and topCodes derive from the per-code analytics rows", () => {
  const rows = [
    { id: "1", code: "A", discountType: "PERCENTAGE", discountValue: 10, scope: "SHOP", isActive: true, totalUsages: 5, usagesInPeriod: 5, totalDiscountGivenCents: 500, usageLimit: null, expiresAt: null },
    { id: "2", code: "B", discountType: "PERCENTAGE", discountValue: 10, scope: "SHOP", isActive: true, totalUsages: 2, usagesInPeriod: 2, totalDiscountGivenCents: 100, usageLimit: null, expiresAt: null },
    { id: "3", code: "C", discountType: "FIXED_AMOUNT", discountValue: 500, scope: "MENU", isActive: true, totalUsages: 1, usagesInPeriod: 0, totalDiscountGivenCents: 0, usageLimit: null, expiresAt: null },
  ];
  expect(usageByScope(rows)).toEqual([{ scope: "SHOP", count: 7 }]);
  expect(topCodes(rows)).toEqual([
    { code: "A", usageCount: 5, discountGivenCents: 500 },
    { code: "B", usageCount: 2, discountGivenCents: 100 },
  ]);
});

test("expiresAt round-trips through formFromPromo -> promoBody in a non-UTC TZ", () => {
  // datetime-local reads/writes local wall-clock time with no offset in the string, and
  // promoBody's `new Date(...)` parse also treats it as local - both sides must agree, or
  // re-saving an untouched expiry silently shifts it by the local UTC offset (this
  // regressed once: formFromPromo used to format in UTC while promoBody parsed as local).
  const prevTz = process.env.TZ;
  process.env.TZ = "America/Denver";
  try {
    for (const original of ["2026-01-15T19:00:00.000Z", "2026-07-15T19:00:00.000Z"]) {
      const form = formFromPromo({
        id: "1", code: "FALL", discountType: "PERCENTAGE", discountValue: 15, maxDiscountCents: null, scope: "ALL",
        totalUsageLimit: null, perUserLimit: 1, currentUsageCount: 0, minimumOrderCents: null, startsAt: original,
        expiresAt: original, isActive: true, description: null,
        targetCategories: [], targetProductIds: [], excludedProductIds: [], locationIds: [],
      } as never);
      const body = promoBody({ ...f, expiresAt: form.expiresAt } as never);
      expect(body.expiresAt).toBe(original);
    }
  } finally {
    process.env.TZ = prevTz;
  }
});
