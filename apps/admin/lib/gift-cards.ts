import type { BadgeTone } from "../components/ui/Badge";

export const CARD_STATUSES = ["ACTIVE", "REDEEMED", "EXHAUSTED", "EXPIRED", "CANCELLED"] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "good", REDEEMED: "info", EXHAUSTED: "neutral", EXPIRED: "pending", CANCELLED: "alert",
};
export const statusTone = (s: string): BadgeTone => STATUS_TONE[s] ?? "neutral";

export type PersonRef = { id: string; name: string | null; email: string | null } | null;

export type GiftCardSummary = {
  id: string; code: string; amountCents: number; balanceCents: number; status: string;
  purchaser: PersonRef; recipientEmail: string | null; recipientName: string | null;
  purchasedAt: string; expiresAt: string | null;
};

export type ShopOrderUsage = { id: string; orderNumber: string; giftCardApplied: number; createdAt: string; totalCents?: number };

export type GiftCardDetail = GiftCardSummary & {
  redeemedBy: PersonRef; personalMessage: string | null; stripePaymentId: string | null; designId: string | null;
  adminNotes: string | null; shopOrders: ShopOrderUsage[];
};

export type Pagination = { page: number; limit: number; totalCount: number; totalPages: number };
export const pageSummary = (p: Pagination) => `Page ${p.page} of ${p.totalPages}`;

export type GiftCardStats = { totalCards: number; byStatus: { active: number; redeemed: number; exhausted: number }; totalSoldCents: number; outstandingBalanceCents: number };

export const purchaserName = (c: Pick<GiftCardSummary, "purchaser">) => c.purchaser?.name || "Guest";
export const recipientName = (c: Pick<GiftCardSummary, "recipientEmail" | "recipientName">) => (c.recipientEmail ? c.recipientName || "Unknown" : "Self");

/** Percent of the original amount still remaining, for the progress bar width. */
export function remainingPercent(amountCents: number, balanceCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((balanceCents / amountCents) * 100)));
}
export function percentUsed(amountCents: number, balanceCents: number): number {
  return 100 - remainingPercent(amountCents, balanceCents);
}

export function isExpired(c: Pick<GiftCardSummary, "expiresAt">, now = new Date()): boolean {
  return Boolean(c.expiresAt) && new Date(c.expiresAt as string) < now;
}

/** Signed dollars-in-cents for the balance adjustment, and the useConfirm copy for it. */
export function adjustmentCents(dollars: string): number | null {
  const t = (dollars ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function adjustmentPrompt(code: string, cents: number): string {
  const dollars = (Math.abs(cents) / 100).toFixed(2);
  return cents >= 0 ? `Add $${dollars} to ${code}?` : `Remove $${dollars} from ${code}?`;
}

// --- Gift card config (setup page) ---

export type Denomination = { id: string; amountCents: number; displayOrder: number; isActive?: boolean };
export type CustomRange = { id: string; minAmountCents: number; maxAmountCents: number };
export type Design = { id: string; designId: string; designName: string; gradient: string; displayOrder: number; isActive: boolean };

export function validateDenomination(dollars: string): string | undefined {
  const cents = adjustmentCents(dollars);
  if (cents === null || cents <= 0) return "Enter an amount greater than 0.";
  return undefined;
}

export function validateCustomRange(minDollars: string, maxDollars: string): { min?: string; max?: string } {
  const errors: { min?: string; max?: string } = {};
  const min = adjustmentCents(minDollars);
  const max = adjustmentCents(maxDollars);
  if (min === null || min < 0) errors.min = "Enter an amount, 0 or more.";
  if (max === null || (min !== null && max <= min)) errors.max = "Enter an amount greater than the minimum.";
  return errors;
}

/** id: lowercased, spaces become "-". */
export function slugifyDesignId(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
