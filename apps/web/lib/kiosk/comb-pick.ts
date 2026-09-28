/**
 * Kiosk pod picking on the comb floor plan (Task D12).
 *
 * The kiosk's order and check-in pages keep their own flow (ids in guest
 * state, dual-pod rules, auto-assign); only the map changed. These pure
 * helpers bridge the two: CombMap speaks pod labels ("B-07"), the kiosk flow
 * keeps seat ids, and the pod is claimed BEFORE payment through
 * POST /kiosk/orders/:id/seat with the label the guest tapped (fix round 1:
 * a conditional claim on the server, never a plain seat write).
 */
import { layoutKeyOf, toCombSeats, type CombLayoutKey, type MapSeat, type SeatsResponse } from "@/components/site/floor-plan/useSeats";

export type KioskComb = { layoutKey: CombLayoutKey | null; seats: MapSeat[] };

/** GET /locations/:id/seats (A8 shape) to what the kiosk map draws. Never throws. */
export function kioskCombFrom(data: unknown): KioskComb {
  const seats = data && typeof data === "object" && !Array.isArray(data) ? toCombSeats(data as SeatsResponse) : [];
  return { layoutKey: layoutKeyOf(data), seats };
}

/**
 * Pods another guest in this party already chose read as reserved, so nobody
 * picks them twice. The other half of a duo the party holds counts as taken
 * too (two guests share it; a third must not take the free-looking half).
 */
export function seatsForPick(seats: MapSeat[], takenIds: readonly string[], selectedId?: string | null): MapSeat[] {
  const taken = new Set(takenIds.filter((id) => id && id !== selectedId));
  const takenLabels = new Set<string>();
  for (const s of seats) {
    if (!taken.has(s.id)) continue;
    takenLabels.add(s.label);
    if (s.podType === "DUAL" && s.dualPartnerLabel) takenLabels.add(s.dualPartnerLabel);
  }
  const selectedLabel = seatById(seats, selectedId)?.label;
  return seats.map((s) => (takenLabels.has(s.label) && s.label !== selectedLabel && s.status === "AVAILABLE" ? { ...s, status: "RESERVED" as const } : s));
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

export type SeatClaim = { label: string; dual: boolean } | { best: true; dual: boolean };

/**
 * Body for POST /kiosk/orders/:id/seat: the tapped pod's label, or the best
 * free pod when the guest has no preference ("auto" or nothing chosen). A
 * party paying together asks for both halves of a duo.
 */
export function seatClaimRequest(seats: MapSeat[], selectedId: string | null | undefined, opts: { canUseDual: boolean }): SeatClaim {
  const seat = selectedId && selectedId !== "auto" ? seatById(seats, selectedId) : undefined;
  if (!seat) return { best: true, dual: opts.canUseDual };
  return { label: seat.label, dual: opts.canUseDual && seat.podType === "DUAL" && Boolean(seat.dualPartnerLabel) };
}

export type SeatClaimResult =
  | { ok: true; seatId: string; label: string; partnerLabel: string | null; takenLabel: string | null }
  | { ok: false; code: string };

/** Reads the claim response: `takenLabel` is set when the requested pod was lost and a new one was held instead. */
export function readSeatClaim(status: number, body: unknown): SeatClaimResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (status !== 200 || typeof b.seatId !== "string" || typeof b.label !== "string") {
    return { ok: false, code: typeof b.code === "string" ? b.code : "CLAIM_FAILED" };
  }
  return {
    ok: true,
    seatId: b.seatId,
    label: b.label,
    partnerLabel: typeof b.partnerLabel === "string" ? b.partnerLabel : null,
    takenLabel: b.code === "POD_TAKEN" && typeof b.requested === "string" ? b.requested : null,
  };
}
