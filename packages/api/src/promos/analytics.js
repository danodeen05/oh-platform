/**
 * Pure helpers for GET /admin/promo-codes/analytics, split out so the
 * date-range filter (the piece that was broken - see below) and the summary
 * shaping can be unit tested without a database.
 *
 * PromoCodeUsage has no `usedAt` column (it has `createdAt`); the inline
 * version of this filter used `usedAt`, so any request with a startDate or
 * endDate query param made Prisma throw "Unknown field `usedAt`" and the
 * whole endpoint 500'd. `buildUsageDateFilter` is the fix, isolated so a
 * future edit can't silently reintroduce the typo.
 */

/** @returns {{}|{createdAt: {gte?: Date, lte?: Date}}} a Prisma where-clause for PromoCodeUsage.createdAt */
export function buildUsageDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const createdAt = {};
  if (startDate) createdAt.gte = new Date(startDate);
  if (endDate) createdAt.lte = new Date(endDate);
  return { createdAt };
}

/**
 * @param {Array<{id:string, code:string, discountType:string, discountValue:number, scope:string,
 *   isActive:boolean, currentUsageCount:number, totalUsageLimit:number|null, expiresAt:Date|null,
 *   usages: Array<{discountCents:number}>}>} promoCodes
 */
export function summarizePromoAnalytics(promoCodes) {
  const analytics = promoCodes.map((code) => {
    const totalDiscountCents = code.usages.reduce((sum, u) => sum + u.discountCents, 0);
    return {
      id: code.id,
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      scope: code.scope,
      isActive: code.isActive,
      totalUsages: code.currentUsageCount,
      usagesInPeriod: code.usages.length,
      totalDiscountGivenCents: totalDiscountCents,
      usageLimit: code.totalUsageLimit,
      expiresAt: code.expiresAt,
    };
  });

  const totalUsages = analytics.reduce((sum, a) => sum + a.usagesInPeriod, 0);
  const totalDiscountCents = analytics.reduce((sum, a) => sum + a.totalDiscountGivenCents, 0);

  return {
    promoCodes: analytics,
    summary: {
      totalCodes: promoCodes.length,
      activeCodes: promoCodes.filter((c) => c.isActive).length,
      totalUsagesInPeriod: totalUsages,
      totalDiscountGivenCents: totalDiscountCents,
    },
  };
}
