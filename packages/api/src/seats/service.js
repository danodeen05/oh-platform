/**
 * Task A8: comb seat reads for the customer/kiosk-facing endpoints.
 *
 * The API is plain Node ESM and never imports `@oh/floor-plan` (a
 * TypeScript package); the geometry (and `Seat.bestRank`) is computed once,
 * offline, by `packages/db/scripts/seed-comb-seats.ts` (run with `tsx`) and
 * persisted on the `Seat` row. This module only reads those stored fields.
 */

/**
 * Fix round 2: the pre-A8 endpoint (git show f7c6cd2:packages/api/src/index.js,
 * `app.get("/locations/:id/seats"`) included each seat's current active order
 * (`orders`, an array of 0 or 1: same status filter, `podCleanedAt: null`,
 * `orderBy: createdAt desc`, `take: 1`), with the order's items+menuItem and a
 * user/guest select. apps/admin's cleaning displays (pods-manager.tsx,
 * kitchen-display.tsx) and the kiosk depend on this for occupancy - the admin
 * session keeps those pages byte-identical, so it must keep coming back.
 *
 * This is hand-assembled with a few flat queries (matched by `seatId`,
 * `orderId`, `menuItemId`) rather than Prisma's nested `include`, so it can
 * be exercised against `prisma-memory` (which doesn't resolve relations) in
 * tests - not just against a real Postgres. The filter, ordering and
 * "most recent per seat" (take 1) semantics are identical to the original
 * nested include.
 */
const ACTIVE_ORDER_STATUSES = ["QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"];

/** @returns {Promise<Map<string, object>>} seatId -> the same shape the old `include: { orders: {...} }` produced (an order plus `items` with `menuItem`, and a `user`/`guest` select), for the most recent active order per seat. */
async function activeOrderBySeatId(prisma, seatIds) {
  const result = new Map();
  if (!seatIds.length) return result;

  const orders = await prisma.order.findMany({
    where: { seatId: { in: seatIds }, status: { in: ACTIVE_ORDER_STATUSES }, podCleanedAt: null },
    orderBy: { createdAt: "desc" },
  });
  // "take: 1" per seat: keep only the first (most recent, since orders is
  // already sorted desc) order seen for each seatId.
  const latestBySeatId = new Map();
  for (const order of orders) {
    if (!latestBySeatId.has(order.seatId)) latestBySeatId.set(order.seatId, order);
  }
  if (!latestBySeatId.size) return result;

  const orderIds = [...latestBySeatId.values()].map((o) => o.id);
  const userIds = [...new Set([...latestBySeatId.values()].map((o) => o.userId).filter(Boolean))];
  const guestIds = [...new Set([...latestBySeatId.values()].map((o) => o.guestId).filter(Boolean))];

  const [orderItems, users, guests] = await Promise.all([
    prisma.orderItem.findMany({ where: { orderId: { in: orderIds } } }),
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } } }) : [],
    guestIds.length ? prisma.guest.findMany({ where: { id: { in: guestIds } } }) : [],
  ]);

  const menuItemIds = [...new Set(orderItems.map((oi) => oi.menuItemId))];
  const menuItems = menuItemIds.length ? await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } }) : [];
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  const itemsByOrderId = new Map();
  for (const item of orderItems) {
    const list = itemsByOrderId.get(item.orderId) ?? [];
    list.push({ ...item, menuItem: menuItemById.get(item.menuItemId) ?? null });
    itemsByOrderId.set(item.orderId, list);
  }
  const userById = new Map(users.map((u) => [u.id, { id: u.id, name: u.name, membershipTier: u.membershipTier }]));
  const guestById = new Map(guests.map((g) => [g.id, { id: g.id, name: g.name }]));

  for (const [seatId, order] of latestBySeatId) {
    result.set(seatId, {
      ...order,
      items: itemsByOrderId.get(order.id) ?? [],
      user: order.userId ? (userById.get(order.userId) ?? null) : null,
      guest: order.guestId ? (guestById.get(order.guestId) ?? null) : null,
    });
  }
  return result;
}

/**
 * Active (non-retired) comb seats for a location, in the documented public
 * shape used by `GET /locations/:id/seats` and folded into
 * `GET /locations/:id/availability`:
 *   { layoutKey, layoutMirror, seats: [{ id, label, finger, rowSide,
 *     position, status, podType, dualPartnerId, orders }] }
 * `orders` is an array of the seat's current active order (0 or 1 entries;
 * same shape as the pre-A8 endpoint - see `activeOrderBySeatId` above).
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

  const ordersBySeatId = await activeOrderBySeatId(prisma, seats.map((s) => s.id));

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
      orders: ordersBySeatId.has(s.id) ? [ordersBySeatId.get(s.id)] : [],
    })),
  };
}
