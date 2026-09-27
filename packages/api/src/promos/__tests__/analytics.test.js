import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUsageDateFilter, summarizePromoAnalytics } from "../analytics.js";

test("buildUsageDateFilter: no dates gives an empty where-clause", () => {
  assert.deepEqual(buildUsageDateFilter(undefined, undefined), {});
});

test("buildUsageDateFilter: filters on createdAt, not the nonexistent usedAt column", () => {
  const filter = buildUsageDateFilter("2026-09-01", "2026-09-30");
  assert.ok("createdAt" in filter, "should key off createdAt");
  assert.ok(!("usedAt" in filter), "PromoCodeUsage has no usedAt column - this used to 500 the whole endpoint");
  assert.deepEqual(filter.createdAt.gte, new Date("2026-09-01"));
  assert.deepEqual(filter.createdAt.lte, new Date("2026-09-30"));
});

test("buildUsageDateFilter: one-sided ranges", () => {
  assert.deepEqual(buildUsageDateFilter("2026-09-01", undefined), { createdAt: { gte: new Date("2026-09-01") } });
  assert.deepEqual(buildUsageDateFilter(undefined, "2026-09-30"), { createdAt: { lte: new Date("2026-09-30") } });
});

test("summarizePromoAnalytics: totals, per-code shape and active count", () => {
  const promoCodes = [
    {
      id: "1", code: "FALL", discountType: "PERCENTAGE", discountValue: 15, scope: "ALL", isActive: true,
      currentUsageCount: 5, totalUsageLimit: 10, expiresAt: null,
      usages: [{ discountCents: 300 }, { discountCents: 200 }],
    },
    {
      id: "2", code: "OLD", discountType: "FIXED_AMOUNT", discountValue: 500, scope: "SHOP", isActive: false,
      currentUsageCount: 1, totalUsageLimit: null, expiresAt: null,
      usages: [],
    },
  ];
  const result = summarizePromoAnalytics(promoCodes);
  assert.deepEqual(result.promoCodes[0], {
    id: "1", code: "FALL", discountType: "PERCENTAGE", discountValue: 15, scope: "ALL", isActive: true,
    totalUsages: 5, usagesInPeriod: 2, totalDiscountGivenCents: 500, usageLimit: 10, expiresAt: null,
  });
  assert.equal(result.summary.totalCodes, 2);
  assert.equal(result.summary.activeCodes, 1);
  assert.equal(result.summary.totalUsagesInPeriod, 2);
  assert.equal(result.summary.totalDiscountGivenCents, 500);
});

test("summarizePromoAnalytics: empty input", () => {
  const result = summarizePromoAnalytics([]);
  assert.deepEqual(result, { promoCodes: [], summary: { totalCodes: 0, activeCodes: 0, totalUsagesInPeriod: 0, totalDiscountGivenCents: 0 } });
});
