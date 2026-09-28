/**
 * Kiosk pod picking on the comb floor plan (Task D12).
 *
 * The kiosk's order and check-in pages keep their own flow (ids in guest
 * state, dual-pod rules, auto-assign); only the map changed. These pure
 * helpers bridge the two: CombMap speaks pod labels ("B-07"), the kiosk flow
 * speaks seat ids, and the order PATCH takes the seat id of the label the
 * guest tapped.
 */
import { layoutKeyOf, toCombSeats, type CombLayoutKey, type MapSeat, type SeatsResponse } from "@/components/site/floor-plan/useSeats";

export type KioskComb = { layoutKey: CombLayoutKey | null; seats: MapSeat[] };

/** GET /locations/:id/seats (A8 shape) to what the kiosk map draws. Never throws. */
export function kioskCombFrom(data: unknown): KioskComb {
  const seats = data && typeof data === "object" && !Array.isArray(data) ? toCombSeats(data as SeatsResponse) : [];
  return { layoutKey: layoutKeyOf(data), seats };
}

/** Pods another guest in this party already chose read as reserved, so nobody picks them twice. */
export function seatsForPick(seats: MapSeat[], takenIds: readonly string[], selectedId?: string | null): MapSeat[] {
  const taken = new Set(takenIds.filter((id) => id && id !== selectedId));
  return seats.map((s) => (taken.has(s.id) && s.status === "AVAILABLE" ? { ...s, status: "RESERVED" as const } : s));
}

const byLabel = (seats: MapSeat[], label: string) => seats.find((s) => s.label === label);
export const seatById = (seats: MapSeat[], id?: string | null) => (id ? seats.find((s) => s.id === id) : undefined);

export type PodPick = { kind: "select"; id: string } | { kind: "clear" } | { kind: "dual-blocked" } | { kind: "none" };

/**
 * What a tap on `label` means. Tapping the selected pod (or its duo partner)
 * clears it; a duo when this party can't take one opens the dual-pod rules.
 */
export function podPick(seats: MapSeat[], label: string, opts: { selectedId?: string | null; canSelectDual: boolean }): PodPick {
  const seat = byLabel(seats, label);
  if (!seat || seat.status !== "AVAILABLE") return { kind: "none" };
  const selected = seatById(seats, opts.selectedId);
  if (selected && (selected.id === seat.id || (selected.podType === "DUAL" && selected.dualPartnerLabel === seat.label))) return { kind: "clear" };
  if (seat.podType === "DUAL" && seat.dualPartnerLabel && !opts.canSelectDual) return { kind: "dual-blocked" };
  return { kind: "select", id: seat.id };
}

/** The selected pod's name for the kiosk's "Pod ... selected" line: "B-07", or "B-07 & B-08" for a duo. */
export function podNames(seats: MapSeat[], id?: string | null): { label: string; duo: boolean } | null {
  const seat = seatById(seats, id);
  if (!seat) return null;
  if (seat.podType === "DUAL" && seat.dualPartnerLabel) {
    const pair = [seat.label, seat.dualPartnerLabel].sort();
    return { label: `${pair[0]} & ${pair[1]}`, duo: true };
  }
  return { label: seat.label, duo: false };
}

/**
 * Body for PATCH /orders/:id once the guest has chosen (the kiosk creates
 * orders before the pod step, so the pod rides on the PATCH): the seat id
 * of the label they tapped, how it was chosen, and a 15 minute hold.
 */
export function podPatchBody(guest: { selectedPodId?: string | null; podAutoAssigned?: boolean }, now = new Date()) {
  if (!guest.selectedPodId || guest.selectedPodId === "auto") return null;
  return {
    seatId: guest.selectedPodId,
    podSelectionMethod: guest.podAutoAssigned ? "AUTO_ASSIGNED" : "CUSTOMER_SELECTED",
    podAssignedAt: now.toISOString(),
    // podConfirmedAt is NOT set here: the guest confirms at the pod with its QR code.
    podReservationExpiry: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
  };
}
