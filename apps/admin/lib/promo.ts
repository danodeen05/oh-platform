import { dollarsToCents } from "../components/ui/Field";
import { money } from "./format";

export const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage off" },
  { value: "FIXED_AMOUNT", label: "Fixed amount off" },
  { value: "FIXED_PER_BOWL", label: "Per-bowl amount off (catering)" },
  { value: "FREE_SHIPPING", label: "Free shipping" },
] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number]["value"];

export const SCOPES = [
  { value: "ALL", label: "All (universal)" },
  { value: "MENU", label: "Menu orders only" },
  { value: "SHOP", label: "Shop orders only" },
  { value: "GIFT_CARD", label: "Gift card purchases only" },
  { value: "CATERING", label: "Catering bookings only" },
] as const;
export type Scope = (typeof SCOPES)[number]["value"];

export const TARGET_CATEGORIES = ["FOOD", "CONDIMENTS", "MERCHANDISE", "APPAREL", "LIMITED_EDITION"] as const;

export type PromoCode = {
  id: string; code: string; discountType: string; discountValue: number; maxDiscountCents: number | null; scope: string;
  totalUsageLimit: number | null; perUserLimit: number; currentUsageCount: number; minimumOrderCents: number | null;
  startsAt: string; expiresAt: string | null; isActive: boolean; description: string | null;
  targetCategories: string[]; targetProductIds: string[]; excludedProductIds: string[]; locationIds: string[];
  _count?: { usages: number };
};

export type PromoForm = {
  code: string; discountType: string; discountValue: string; maxDiscountCents: string; scope: string;
  totalUsageLimit: string; perUserLimit: string; minimumOrderCents: string; expiresAt: string; description: string;
  targetCategories: string[]; targetProductIds: string[]; excludedProductIds: string[]; locationIds: string[];
};

export function emptyPromoForm(): PromoForm {
  return {
    code: "", discountType: "PERCENTAGE", discountValue: "", maxDiscountCents: "", scope: "ALL",
    totalUsageLimit: "", perUserLimit: "1", minimumOrderCents: "", expiresAt: "", description: "",
    targetCategories: [], targetProductIds: [], excludedProductIds: [], locationIds: [],
  };
}

const dollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));
/**
 * A `datetime-local` input reads and writes its value as local wall-clock time (no
 * timezone in the string), and `promoBody` parses it back with `new Date(...)`, which
 * also treats a timezone-less string as local time. So this must format in local time
 * too - `toISOString()` (always UTC) would drift the saved expiry by the local UTC
 * offset (6-7h in Denver) on every edit, even one that didn't touch the field.
 */
const toDatetimeLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function formFromPromo(p: PromoCode | null): PromoForm {
  if (!p) return emptyPromoForm();
  return {
    code: p.code, discountType: p.discountType,
    discountValue: p.discountType === "PERCENTAGE" ? String(p.discountValue) : dollars(p.discountValue),
    maxDiscountCents: dollars(p.maxDiscountCents), scope: p.scope,
    totalUsageLimit: p.totalUsageLimit != null ? String(p.totalUsageLimit) : "",
    perUserLimit: String(p.perUserLimit ?? 1),
    minimumOrderCents: dollars(p.minimumOrderCents), expiresAt: toDatetimeLocal(p.expiresAt),
    description: p.description ?? "",
    targetCategories: p.targetCategories ?? [], targetProductIds: p.targetProductIds ?? [],
    excludedProductIds: p.excludedProductIds ?? [], locationIds: p.locationIds ?? [],
  };
}

/** Field errors for the sheet. FREE_SHIPPING needs no discountValue (that was the old bug: it used to be required). */
export function validatePromo(f: PromoForm): Partial<Record<keyof PromoForm, string>> {
  const errors: Partial<Record<keyof PromoForm, string>> = {};
  if (!(f.code ?? "").trim()) errors.code = "Give the promo a code.";

  if (f.discountType === "FIXED_PER_BOWL" && f.scope !== "CATERING") {
    errors.discountType = "Per-bowl discounts need the Catering scope.";
  }

  if (f.discountType !== "FREE_SHIPPING") {
    const raw = (f.discountValue ?? "").trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) errors.discountValue = "Enter a value greater than 0.";
    else if (f.discountType === "PERCENTAGE" && n > 100) errors.discountValue = "A percentage can't be more than 100.";
  }

  const wholePositive = (s: string | undefined) => {
    const t = (s ?? "").trim();
    return t === "" || (/^\d+$/.test(t) && Number(t) > 0);
  };
  if (!wholePositive(f.perUserLimit)) errors.perUserLimit = "Use a whole number.";
  if (!wholePositive(f.totalUsageLimit)) errors.totalUsageLimit = "Use a whole number.";

  return errors;
}

export type PromoBody = {
  code: string; discountType: string; discountValue: number; maxDiscountCents: number | null; scope: string;
  totalUsageLimit: number | null; perUserLimit: number; minimumOrderCents: number | null;
  expiresAt: string | null; description: string | null;
  targetCategories: string[] | null; targetProductIds: string[] | null; excludedProductIds: string[] | null; locationIds: string[] | null;
};

const arrOrNull = (a: string[] | undefined) => (a && a.length > 0 ? a : null);
const intOrNull = (s: string | undefined) => {
  const t = (s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
};

function discountValueCents(f: PromoForm): number {
  if (f.discountType === "FREE_SHIPPING") return 0;
  if (f.discountType === "PERCENTAGE") return Math.round(Number(f.discountValue)) || 0;
  return dollarsToCents(f.discountValue ?? "") ?? 0;
}

/** The PATCH/POST body, in the shape the API already accepts. */
export function promoBody(f: PromoForm): PromoBody {
  return {
    code: (f.code ?? "").trim().toUpperCase(),
    discountType: f.discountType,
    discountValue: discountValueCents(f),
    maxDiscountCents: f.discountType === "PERCENTAGE" ? dollarsToCents(f.maxDiscountCents ?? "") : null,
    scope: f.scope,
    totalUsageLimit: intOrNull(f.totalUsageLimit),
    perUserLimit: intOrNull(f.perUserLimit) ?? 1,
    minimumOrderCents: dollarsToCents(f.minimumOrderCents ?? ""),
    expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
    description: (f.description ?? "").trim() || null,
    targetCategories: arrOrNull(f.targetCategories),
    targetProductIds: arrOrNull(f.targetProductIds),
    excludedProductIds: arrOrNull(f.excludedProductIds),
    locationIds: arrOrNull(f.locationIds),
  };
}

/** "15% (max $5.00)", "$2.00 per bowl", "Free shipping". */
export function formatDiscount(p: { discountType: string; discountValue: number; maxDiscountCents?: number | null }): string {
  switch (p.discountType) {
    case "PERCENTAGE":
      return `${p.discountValue}%${p.maxDiscountCents ? ` (max ${money(p.maxDiscountCents)})` : ""}`;
    case "FIXED_AMOUNT":
      return money(p.discountValue);
    case "FIXED_PER_BOWL":
      return `${money(p.discountValue)} per bowl`;
    case "FREE_SHIPPING":
      return "Free shipping";
    default:
      return "";
  }
}

export function usageText(p: Pick<PromoCode, "currentUsageCount" | "totalUsageLimit">): string {
  return `${p.currentUsageCount}/${p.totalUsageLimit ?? "∞"}`;
}

export function isExpired(p: Pick<PromoCode, "expiresAt">, now = new Date()): boolean {
  return Boolean(p.expiresAt) && new Date(p.expiresAt as string) < now;
}

export function statusLabel(p: Pick<PromoCode, "isActive" | "expiresAt">, now = new Date()): "Expired" | "Active" | "Inactive" {
  if (isExpired(p, now)) return "Expired";
  return p.isActive ? "Active" : "Inactive";
}

export function hasTargeting(p: Pick<PromoCode, "targetCategories" | "targetProductIds" | "excludedProductIds" | "locationIds">): boolean {
  return p.targetCategories.length > 0 || p.targetProductIds.length > 0 || p.excludedProductIds.length > 0 || p.locationIds.length > 0;
}

export type PromoAnalyticsRow = {
  id: string; code: string; discountType: string; discountValue: number; scope: string; isActive: boolean;
  totalUsages: number; usagesInPeriod: number; totalDiscountGivenCents: number; usageLimit: number | null; expiresAt: string | null;
};
export type PromoAnalytics = {
  promoCodes: PromoAnalyticsRow[];
  summary: { totalCodes: number; activeCodes: number; totalUsagesInPeriod: number; totalDiscountGivenCents: number };
};

/** The API only returns per-code rows; group by scope and rank top codes client-side. */
export function usageByScope(rows: PromoAnalyticsRow[]): { scope: string; count: number }[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.scope, (by.get(r.scope) ?? 0) + r.usagesInPeriod);
  return [...by.entries()].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).map(([scope, count]) => ({ scope, count }));
}

export function topCodes(rows: PromoAnalyticsRow[], limit = 5): { code: string; usageCount: number; discountGivenCents: number }[] {
  return [...rows]
    .filter((r) => r.usagesInPeriod > 0)
    .sort((a, b) => b.usagesInPeriod - a.usagesInPeriod)
    .slice(0, limit)
    .map((r) => ({ code: r.code, usageCount: r.usagesInPeriod, discountGivenCents: r.totalDiscountGivenCents }));
}
