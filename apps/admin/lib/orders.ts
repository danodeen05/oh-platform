import type { BadgeTone } from "../components/ui/Badge";
import { relativeTime } from "./format";

const LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment", PAID: "Paid", QUEUED: "In queue", PREPPING: "Prepping",
  READY: "Ready", SERVING: "Dining", COMPLETED: "Done", CANCELLED: "Cancelled",
};
const TONE: Record<string, BadgeTone> = {
  PENDING_PAYMENT: "pending", PAID: "info", QUEUED: "info", PREPPING: "pending",
  READY: "good", SERVING: "good", COMPLETED: "neutral", CANCELLED: "alert",
};
export const statusLabel = (s: string) => LABEL[s] ?? s.toLowerCase();
export const statusTone = (s: string): BadgeTone => TONE[s] ?? "neutral";
export const STEP_LABELS: Record<string, string> = {
  createdAt: "Ordered", paidAt: "Paid", arrivedAt: "Arrived", queuedAt: "Queued",
  prepStartTime: "Prep started", readyTime: "Ready", deliveredAt: "Delivered to pod", completedTime: "Finished",
};

export type OrderSummary = {
  id: string; orderNumber: string; kitchenOrderNumber: string | null; status: string; paymentStatus: string; totalCents: number;
  createdAt: string; orderSource: string; locationName: string | null; seatNumber: number | null; customerName: string; phoneLast4: string | null;
};
export type OrderDetail = OrderSummary & {
  customerEmail: string | null; customerPhone: string | null;
  items: { name: string; quantity: number; priceCents: number; selectedValue: string | null }[];
  taxCents: number | null; promoDiscountCents: number | null; paymentMethodBrand: string | null; paymentMethodLast4: string | null;
  timeline: { step: string; at: string }[];
  podCalls: { id: string; reason: string; status: string; createdAt: string }[];
};

export const orderTitle = (o: Pick<OrderSummary, "orderNumber" | "kitchenOrderNumber">) =>
  o.kitchenOrderNumber ? `#${o.orderNumber} · K${o.kitchenOrderNumber}` : `#${o.orderNumber}`;

export const orderMeta = (o: Pick<OrderSummary, "customerName" | "locationName" | "seatNumber" | "createdAt">, now = new Date()) =>
  [o.customerName, o.locationName, o.seatNumber != null ? `Pod ${o.seatNumber}` : null, relativeTime(o.createdAt, now)].filter(Boolean).join(" · ");

/** "WEB" to "Web", "KIOSK" to "Kiosk". */
export const sourceLabel = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ") : "");
export const paymentLabel = (s: string | null | undefined) => sourceLabel(s);

const PAY_TONE: Record<string, BadgeTone> = { PAID: "good", PENDING: "pending", FAILED: "alert", REFUNDED: "neutral" };
export const paymentTone = (s: string | null | undefined): BadgeTone => (s && PAY_TONE[s]) || "neutral";
