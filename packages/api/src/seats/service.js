/**
 * Task A8: comb seat reads for the customer/kiosk-facing endpoints.
 *
 * The API is plain Node ESM and never imports `@oh/floor-plan` (a
 * TypeScript package); the geometry (and `Seat.bestRank`) is computed once,
 * offline, by `packages/db/scripts/seed-comb-seats.ts` (run with `tsx`) and
 * persisted on the `Seat` row. This module only reads those stored fields.
 */

/**
 * Active (non-retired) comb seats for a location, in the documented public
 * shape used by `GET /locations/:id/seats` and folded into
 * `GET /locations/:id/availability`:
 *   { layoutKey, layoutMirror, seats: [{ id, label, finger, rowSide,
 *     position, status, podType, dualPartnerId }] }
 *
 * `location` may be passed in already-fetched (as `/availability` does, for
 * its own operating-hours query) to avoid a second lookup; otherwise it's
 * fetched here. An unknown location yields `layoutKey: null,
 * layoutMirror: false, seats: []` rather than throwing - this matches the
 * endpoint's pre-A8 behavior of never 404ing on the seats list.
 */
export async function listLocationSeats(prisma, locationId, location = undefined) {
  const loc = location !== undefined ? location : await prisma.location.findUnique({ where: { id: locationId } });

  const seats = await prisma.seat.findMany({
    where: { locationId, retiredAt: null },
    orderBy: { number: "asc" },
  });

  return {
    layoutKey: loc?.layoutKey ?? null,
    layoutMirror: loc?.layoutMirror ?? false,
    seats: seats.map((s) => ({
      id: s.id,
      label: s.label,
      finger: s.finger,
      rowSide: s.rowSide,
      position: s.position,
      status: s.status,
      podType: s.podType,
      dualPartnerId: s.dualPartnerId ?? null,
    })),
  };
}
