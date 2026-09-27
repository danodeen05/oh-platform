import type { BadgeTone } from "../components/ui/Badge";

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
// Matches the ShopFulfillmentStatus enum in schema.prisma. The old admin UI listed a
// "DELIVERED" status that has never existed here; the real terminal states are
// READY_PICKUP and COMPLETED.
export const FULFILLMENT_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "READY_PICKUP", "COMPLETED", "CANCELLED"] as const;
export const FULFILLMENT_TYPES = ["SHIPPING", "IN_STORE_PICKUP"] as const;
export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;

export type ShopOrderItem = { id: string; quantity: number; priceCents: number; product: { id: string; name: string; slug: string; imageUrl: string | null } };
export type PersonRef = { id: string; name: string | null; email: string | null; phone?: string | null } | null;

export type ShopOrderSummary = {
  id: string; orderNumber: string; createdAt: string; totalCents: number;
  paymentStatus: string; fulfillmentStatus: string; fulfillmentType: string;
  trackingNumber: string | null; items: ShopOrderItem[]; user: PersonRef; guest: PersonRef;
};

export type ShopOrderDetail = ShopOrderSummary & {
  subtotalCents: number; taxCents: number; shippingCents: number; promoDiscountCents: number;
  shippingName: string | null; shippingAddress1: string | null; shippingAddress2: string | null;
  shippingCity: string | null; shippingState: string | null; shippingZip: string | null; shippingCountry: string | null;
  stripePaymentId: string | null; trackingUrl: string | null; trackingCarrier: string | null; adminNotes: string | null;
  giftCard: { id: string; code: string; amountCents: number } | null;
  promoCode: { id: string; code: string; discountType: string; discountValue: number } | null;
};

export type Pagination = { page: number; limit: number; totalCount: number; totalPages: number };

export type ShopOrderStats = { totalOrders: number; byStatus: { pending: number; processing: number; shipped: number; completed: number; cancelled: number }; totalRevenueCents: number };

const FULFILLMENT_LABEL: Record<string, string> = {
  PENDING: "Pending", PROCESSING: "Processing", SHIPPED: "Shipped", READY_PICKUP: "Ready for pickup", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const FULFILLMENT_TONE: Record<string, BadgeTone> = {
  PENDING: "neutral", PROCESSING: "pending", SHIPPED: "info", READY_PICKUP: "info", COMPLETED: "good", CANCELLED: "alert",
};
export const fulfillmentLabel = (s: string) => FULFILLMENT_LABEL[s] ?? s;
export const fulfillmentTone = (s: string): BadgeTone => FULFILLMENT_TONE[s] ?? "neutral";

const PAYMENT_LABEL: Record<string, string> = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed", REFUNDED: "Refunded" };
const PAYMENT_TONE: Record<string, BadgeTone> = { PENDING: "pending", PAID: "good", FAILED: "alert", REFUNDED: "neutral" };
export const paymentLabel = (s: string) => PAYMENT_LABEL[s] ?? s;
export const paymentTone = (s: string): BadgeTone => PAYMENT_TONE[s] ?? "neutral";

export const typeLabel = (s: string) => (s === "SHIPPING" ? "Shipping" : "In-store pickup");

/** "SHIPPED" is terminal-ish once shipped or fully done; that's when "Mark as shipped" hides. */
export const isShipped = (status: string) => status === "SHIPPED" || status === "COMPLETED";

/** "Mark as shipped" only makes sense for a shippable order that isn't already done or cancelled. */
export function canMarkShipped(o: Pick<ShopOrderSummary, "fulfillmentStatus" | "fulfillmentType">): boolean {
  return o.fulfillmentType !== "IN_STORE_PICKUP" && o.fulfillmentStatus !== "CANCELLED" && !isShipped(o.fulfillmentStatus);
}

export function customerName(o: Pick<ShopOrderSummary, "user" | "guest">): string {
  return o.user?.name || o.guest?.name || "Guest";
}
export function customerEmail(o: Pick<ShopOrderSummary, "user" | "guest">): string | null {
  return o.user?.email || o.guest?.email || null;
}

export function itemCount(items: ShopOrderItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

/** "3 items · 2x Home Kit, 1x Chili Oil" for the row's secondary line. */
export function itemsSummary(items: ShopOrderItem[]): string {
  const count = itemCount(items);
  const label = `${count} ${count === 1 ? "item" : "items"}`;
  const detail = items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ");
  return detail ? `${label} · ${detail}` : label;
}

export function pageSummary(p: Pagination): string {
  return `Page ${p.page} of ${p.totalPages}`;
}

function denverOffsetMinutes(date: Date): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "shortOffset" })
    .formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT-7";
  const m = /GMT([+-]\d+)/.exec(part);
  return m ? Number(m[1]) * 60 : -420;
}

/** The Denver calendar day containing `now`, as UTC instant bounds - safe to send as startDate/endDate. */
export function denverDayRange(now = new Date()): { startDate: string; endDate: string } {
  const offsetMin = denverOffsetMinutes(now);
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now).split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMin * 60_000;
  return { startDate: new Date(startMs).toISOString(), endDate: new Date(startMs + 24 * 3600 * 1000).toISOString() };
}
