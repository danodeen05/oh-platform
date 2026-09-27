/** Seats (pods) configurator: pure grid, selection and link/unlink helpers. */

export type SeatStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";

export type Seat = {
  id: string;
  number: string;
  status: SeatStatus;
  podType: "SINGLE" | "DUAL";
  dualPartnerId: string | null;
};

/** "01" -> 1, so string-padded numbers (and a future "B-07" format) sort numerically. */
function numericValue(number: string): number {
  const m = number.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function sortByNumber(seats: Seat[]): Seat[] {
  return [...seats].sort((a, b) => numericValue(a.number) - numericValue(b.number));
}

/** Dual pods come in linked pairs, so the pair count is half the row count. */
export function dualPodCount(seats: Seat[]): number {
  return seats.filter((s) => s.podType === "DUAL").length / 2;
}

export function singlePodCount(seats: Seat[]): number {
  return seats.filter((s) => s.podType === "SINGLE" && !s.dualPartnerId).length;
}

export function partnerNumber(seats: Seat[], seat: Seat): string | null {
  if (!seat.dualPartnerId) return null;
  return seats.find((s) => s.id === seat.dualPartnerId)?.number ?? null;
}

/** Tapping a non-dual pod selects it. At most 2 can be selected; a third replaces the oldest. */
export function toggleSelection(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  if (selected.length >= 2) return [selected[1], id];
  return [...selected, id];
}

export type LinkCheck = { ok: true } | { ok: false; reason: string };

/** "Link as dual pod" is enabled at exactly 2 selections, and errors if either is already linked. */
export function canLinkDual(seats: Seat[], selected: string[]): LinkCheck {
  if (selected.length !== 2) return { ok: false, reason: "Select exactly 2 pods." };
  const [a, b] = selected.map((id) => seats.find((s) => s.id === id));
  if (!a || !b) return { ok: false, reason: "Pod not found." };
  if (a.dualPartnerId || b.dualPartnerId) return { ok: false, reason: "One or both pods are already linked. Unlink them first." };
  return { ok: true };
}

export function selectionLabel(seats: Seat[], selected: string[]): string {
  const numbers = selected.map((id) => seats.find((s) => s.id === id)?.number).filter(Boolean);
  if (numbers.length === 0) return "";
  if (numbers.length === 1) return `Selected: Pod ${numbers[0]}`;
  return `Selected: Pods ${numbers.join(" and ")}`;
}
