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
  createdAt: string; orderSource: string; locationName: string | null; seatNumber: string | number | null;
  /** Comb pod label ("B-07"), else the legacy number (Task D12). Older APIs omit it. */
  seatLabel?: string | number | null; customerName: string; phoneLast4: string | null;
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

/** The pod name staff see: the comb label ("B-07"), falling back to the number for retired legacy seats. */
export const podLabel = (o: Pick<OrderSummary, "seatNumber" | "seatLabel">): string | null => {
  const v = o.seatLabel ?? o.seatNumber;
  return v == null || v === "" ? null : String(v);
};

export const orderMeta = (o: Pick<OrderSummary, "customerName" | "locationName" | "seatNumber" | "seatLabel" | "createdAt">, now = new Date()) =>
  [o.customerName, o.locationName, podLabel(o) ? `Pod ${podLabel(o)}` : null, relativeTime(o.createdAt, now)].filter(Boolean).join(" · ");

/** "WEB" to "Web", "KIOSK" to "Kiosk". */
export const sourceLabel = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ") : "");
export const paymentLabel = (s: string | null | undefined) => sourceLabel(s);

const PAY_TONE: Record<string, BadgeTone> = { PAID: "good", PENDING: "pending", FAILED: "alert", REFUNDED: "neutral" };
export const paymentTone = (s: string | null | undefined): BadgeTone => (s && PAY_TONE[s]) || "neutral";
