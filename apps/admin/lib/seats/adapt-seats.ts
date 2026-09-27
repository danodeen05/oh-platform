/**
 * Task A8 changed `GET /locations/:id/seats` from a bare array (with
 * `number`, `qrCode`, `locationId`, `row`/`col`/`side`, and an included
 * `orders` relation) to `{ layoutKey, layoutMirror, seats: [...] }`, where
 * each comb seat only carries `{id, label, finger, rowSide, position,
 * status, podType, dualPartnerId}`. `qrCode`, `locationId`, `createdAt` and
 * `orders` are no longer in the response at all.
 *
 * `apps/admin`'s cleaning/pod-configurator pages predate the comb layout and
 * read a bare array keyed on `.number` (some also read `.qrCode`/`.orders`,
 * which the new endpoint doesn't return). `extractSeatsArray` keeps them
 * from crashing (`TypeError: seats.filter/.push is not a function`,
 * duplicated in this app since it has no shared package with `apps/web`);
 * `seatDisplayNumber` picks the comb `label` when present, else the legacy
 * `number`. Fields the endpoint no longer returns (`qrCode`, `createdAt`,
 * `orders`) default to blank/empty - occupancy and QR details for comb pods
 * are out of scope for A8 (see Tasks D4/D5 and a follow-up admin task).
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
