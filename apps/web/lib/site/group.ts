/**
 * Group lobby helpers (Task D11). Pure functions: the pod pick on the
 * CombMap (one pod per member, both halves of a duo for two members), the
 * pick's URL form for the group payment page, and the lobby's money and
 * status reads. Tested in lib/site/__tests__/group.test.ts.
 */
import type { MapSeat } from "@/components/site/floor-plan/useSeats";

export type GroupStatus = "GATHERING" | "CLOSED" | "PAYING" | "PAID" | "PARTIALLY_PAID" | "CANCELLED";

export interface GroupMemberOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  amountDueCents?: number | null;
  userId: string | null;
  guestId: string | null;
  isGroupHost: boolean;
  createdAt?: string;
  user: { id: string; name: string | null } | null;
  guest: { id: string; name: string | null } | null;
  seat: { id: string; number: string; label: string | null } | null;
  items: Array<{
    id: string;
    quantity: number;
    priceCents: number;
    selectedValue: string | null;
    menuItem: { name: string; category: string | null; sliderConfig?: { labels?: string[]; displayLabels?: string[] } | null };
  }>;
}

export interface Group {
  id: string;
  code: string;
  hostUserId: string | null;
  hostGuestId: string | null;
  locationId: string;
  status: GroupStatus;
  paymentMethod: "HOST_PAYS_ALL" | "PAY_YOUR_OWN" | null;
  expiresAt: string;
  estimatedArrival: string | null;
  location: { id: string; name: string; address: string };
  orders: GroupMemberOrder[];
}

/** pick: orderId -> pod label. */
export type Picks = Record<string, string>;

/** Live (not cancelled) orders, oldest first: the order members joined in. */
export function liveOrders(group: Pick<Group, "orders">): GroupMemberOrder[] {
  return group.orders
    .filter((o) => o.status !== "CANCELLED")
    .slice()
    .sort((a, b) => (a.createdAt && b.createdAt ? a.createdAt.localeCompare(b.createdAt) : 0) || (a.isGroupHost === b.isGroupHost ? 0 : a.isGroupHost ? -1 : 1));
}

/** The name the API gave us (A8b: "First L." for anyone but yourself), else null for the page to label. */
export function memberName(order: GroupMemberOrder): string | null {
  const n = order.user?.name ?? (order.guest?.name && order.guest.name !== "Guest" ? order.guest.name : null);
  return n && n.trim() ? n.trim() : null;
}

/** What still has to be paid: each unpaid order's server-quoted amount due. */
export function amountDue(orders: GroupMemberOrder[]): number {
  return orders.filter((o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED").reduce((s, o) => s + (o.amountDueCents ?? o.totalCents), 0);
}

export function groupTotal(orders: GroupMemberOrder[]): number {
  return orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.totalCents, 0);
}

/** Arriving now (no arrival set, or within 30 minutes): pods can be picked. Later groups are seated at the kiosk. */
export function arrivesSoon(estimatedArrival: string | null, now: number): boolean {
  if (!estimatedArrival) return true;
  const t = new Date(estimatedArrival).getTime();
  return Number.isNaN(t) || t - now <= 30 * 60 * 1000;
}

/** Seats as the map draws them for the member being picked: pods other members hold read as reserved. */
export function seatsForMember(seats: MapSeat[], picks: Picks, activeOrderId: string | null): MapSeat[] {
  const taken = new Set(Object.entries(picks).filter(([id]) => id !== activeOrderId).map(([, label]) => label));
  return seats.map((s) => (taken.has(s.label) && s.status === "AVAILABLE" ? { ...s, status: "RESERVED" as const } : s));
}

/** The next member without a pod after `from` (wrapping), or null when everyone has one. */
export function nextUnpicked(orderIds: string[], picks: Picks, from: string | null): string | null {
  const start = from ? orderIds.indexOf(from) : -1;
  for (let k = 1; k <= orderIds.length; k++) {
    const id = orderIds[(start + k + orderIds.length) % orderIds.length] as string;
    if (!picks[id]) return id;
  }
  return null;
}

/**
 * A tap on pod `label` while picking for `active`:
 *  - the active member's own pod clears it;
 *  - a free pod becomes theirs;
 *  - a free duo half also seats the next member without a pod at the other
 *    half, when that half is free (a duo seats two side by side).
 * Returns the new picks and who is picked for next.
 */
export function pickPod(seats: MapSeat[], orderIds: string[], picks: Picks, active: string, label: string): { picks: Picks; active: string | null } {
  if (picks[active] === label) {
    const next = { ...picks };
    delete next[active];
    return { picks: next, active };
  }
  const shown = seatsForMember(seats, picks, active);
  const seat = shown.find((s) => s.label === label);
  if (!seat || seat.status !== "AVAILABLE") return { picks, active };
  const next: Picks = { ...picks, [active]: label };
  if (seat.podType === "DUAL" && seat.dualPartnerLabel) {
    const partner = shown.find((s) => s.label === seat.dualPartnerLabel);
    const buddy = nextUnpicked(orderIds, next, active);
    if (partner && partner.status === "AVAILABLE" && buddy && !Object.values(next).includes(partner.label)) next[buddy] = partner.label;
  }
  return { picks: next, active: nextUnpicked(orderIds, next, active) ?? active };
}

/**
 * Fills every member without a pod, best pods first (bestRank, the
 * entry-nearest walking order). Pairs of unpicked members take a free duo
 * together first; single members prefer single pods.
 */
export function pickRest(seats: MapSeat[], orderIds: string[], picks: Picks): Picks {
  const next: Picks = { ...picks };
  const used = () => new Set(Object.values(next));
  const rank = (s: MapSeat) => s.bestRank ?? Number.MAX_SAFE_INTEGER;
  const free = () => seats.filter((s) => s.status === "AVAILABLE" && !used().has(s.label)).sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  let waiting = orderIds.filter((id) => !next[id]);
  while (waiting.length >= 2) {
    const f = free();
    const labels = new Set(f.map((s) => s.label));
    const duo = f.find((s) => s.podType === "DUAL" && s.dualPartnerLabel && labels.has(s.dualPartnerLabel));
    if (!duo) break;
    next[waiting[0] as string] = duo.label;
    next[waiting[1] as string] = duo.dualPartnerLabel as string;
    waiting = waiting.slice(2);
  }
  for (const id of waiting) {
    const f = free();
    const pod = f.find((s) => s.podType !== "DUAL") ?? f[0];
    if (!pod) break;
    next[id] = pod.label;
  }
  return next;
}

const POD_LABEL = /^[A-Z]-\d{2}$/;

/** Picks as a URL value: "orderId:B-07,orderId:B-08". */
export function encodePods(picks: Picks): string {
  return Object.entries(picks)
    .filter(([id, label]) => id && POD_LABEL.test(label))
    .map(([id, label]) => `${id}:${label}`)
    .join(",");
}

export function decodePods(value: string | null | undefined): Picks {
  const out: Picks = {};
  for (const part of (value ?? "").split(",")) {
    const [id, label] = part.split(":");
    if (id && label && /^[A-Za-z0-9_-]{1,64}$/.test(id) && POD_LABEL.test(label)) out[id] = label;
  }
  return out;
}

/** "12:05" style countdown from seconds. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A slider line's value in the reader's language: `displayLabels` at the English label's index (F1a). */
export function displayValue(item: GroupMemberOrder["items"][number]): string | null {
  const v = item.selectedValue;
  if (!v) return null;
  const cfg = item.menuItem.sliderConfig;
  const i = cfg?.labels?.indexOf(v) ?? -1;
  return i >= 0 && cfg?.displayLabels?.[i] ? cfg.displayLabels[i] : v;
}

export function isBowlItem(category: string | null): boolean {
  const c = category ?? "";
  return c.startsWith("main") || c.startsWith("slider");
}
