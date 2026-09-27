/**
 * Task A8 changed `GET /locations/:id/seats` (and the seat portion of
 * `GET /locations/:id/availability`) from a bare array of seats to
 * `{ layoutKey, layoutMirror, seats: [...] }`, and comb seats carry `label`
 * (e.g. "B-07") instead of the old `number`. The kiosk, group and
 * location-order UIs below predate the comb layout - Tasks D4/D5 replace
 * them - and read a bare array keyed on `.number`. Without this adapter,
 * `setSeats(json)` stores the wrapper object, and a later `seats.filter(...)`
 * /`.find(...)`/`.some(...)` at render throws
 * `TypeError: seats.filter is not a function`, taking the whole page down
 * (Task A8 fix round 1, Critical).
 *
 * `extractSeatsArray` unwraps the new shape - or passes a bare array through
 * unchanged, for safety/back-compat with the pre-A8 shape - and never
 * throws. `seatDisplayNumber` picks what to show as the pod number: the comb
 * `label` when present, else the legacy `number`. `adaptKioskSeats` covers
 * the kiosk check-in/order-flow pages, which share one legacy `Seat` shape.
 */

export function extractSeatsArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const seats = (data as { seats?: unknown }).seats;
    if (Array.isArray(seats)) return seats as Record<string, unknown>[];
  }
  return [];
}

export function seatDisplayNumber(seat: Record<string, unknown>, fallback = ""): string {
  if (typeof seat.label === "string" && seat.label) return seat.label;
  if (typeof seat.number === "string" && seat.number) return seat.number;
  return fallback;
}

export interface KioskLegacySeat {
  id: string;
  number: string;
  status: string;
  podType: "SINGLE" | "DUAL";
  row: number;
  col: number;
  side: string;
  dualPartnerId?: string;
}

/** Shared by kiosk/check-in/page.tsx and kiosk/order/kiosk-order-flow.tsx (identical local `Seat` type). */
export function adaptKioskSeats(data: unknown): KioskLegacySeat[] {
  return extractSeatsArray(data).map((s, i) => ({
    id: String(s.id ?? ""),
    number: seatDisplayNumber(s, String(i + 1).padStart(2, "0")),
    status: typeof s.status === "string" ? s.status : "AVAILABLE",
    podType: s.podType === "DUAL" ? "DUAL" : "SINGLE",
    row: typeof s.row === "number" ? s.row : 0,
    col: typeof s.col === "number" ? s.col : i,
    side: typeof s.side === "string" ? s.side : "left",
    dualPartnerId: typeof s.dualPartnerId === "string" ? s.dualPartnerId : undefined,
  }));
}
