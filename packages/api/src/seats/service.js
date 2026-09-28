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
 * Task A8b: seatId -> the order's userId (or null), for the most recent
 * active order per seat - the same "most recent, take 1" semantics as
 * `activeOrderBySeatId`, but without the items/user/guest enrichment. Used
 * for the public shape's `isMine`, and as the first step of the staff shape
 * (which enriches from here - see `activeOrderBySeatId`).
 */
async function latestActiveOrdersBySeatId(prisma, seatIds) {
  const latestBySeatId = new Map();
  if (!seatIds.length) return latestBySeatId;
  const orders = await prisma.order.findMany({
    where: { seatId: { in: seatIds }, status: { in: ACTIVE_ORDER_STATUSES }, podCleanedAt: null },
    orderBy: { createdAt: "desc" },
  });
  for (const order of orders) {
    if (!latestBySeatId.has(order.seatId)) latestBySeatId.set(order.seatId, order);
  }
  return latestBySeatId;
}

/**
 * Active (non-retired) comb seats for a location, used by
 * `GET /locations/:id/seats` and folded into `GET /locations/:id/availability`.
 *
 * Task A8b: these routes are PUBLIC, so the shape depends on `viewer`:
 *   - Anonymous or customer callers (default; `viewer.isStaff` falsy) get
 *     `{ layoutKey, layoutMirror, seats: [{ id, label, finger, rowSide,
 *     position, status, podType, dualPartnerId, bestRank }] }` - no
 *     `orders`, no names, no tier, no items. A signed-in customer
 *     (`viewer.userId` set) additionally sees `isMine: true` on the one
 *     seat whose active order they own, and nothing else.
 *   - Staff callers (`viewer.isStaff: true` - see `resolveSeatViewer` below)
 *     get the same seat fields plus the per-seat `orders`, restored exactly
 *     as A8 had them: an array of the seat's current active order (0 or 1
 *     entries), with items+menuItem and a user/guest select (see
 *     `activeOrderBySeatId` above).
 *
 * `location` may be passed in already-fetched (as `/availability` does, for
 * its own operating-hours query) to avoid a second lookup; otherwise it's
 * fetched here. An unknown location yields `layoutKey: null,
 * layoutMirror: false, seats: []` rather than throwing - this matches the
 * endpoint's pre-A8 behavior of never 404ing on the seats list.
 */
export async function listLocationSeats(prisma, locationId, location = undefined, viewer = {}) {
  const { isStaff = false, userId = null } = viewer;
  const loc = location !== undefined ? location : await prisma.location.findUnique({ where: { id: locationId } });

  const seats = await prisma.seat.findMany({
    where: { locationId, retiredAt: null },
    orderBy: { number: "asc" },
  });
  const seatIds = seats.map((s) => s.id);

  const baseSeat = (s) => ({
    id: s.id,
    label: s.label,
    finger: s.finger,
    rowSide: s.rowSide,
    position: s.position,
    status: s.status,
    podType: s.podType,
    dualPartnerId: s.dualPartnerId ?? null,
    bestRank: s.bestRank ?? null,
  });

  if (isStaff) {
    const ordersBySeatId = await activeOrderBySeatId(prisma, seatIds);
    return {
      layoutKey: loc?.layoutKey ?? null,
      layoutMirror: loc?.layoutMirror ?? false,
      seats: seats.map((s) => ({
        ...baseSeat(s),
        orders: ordersBySeatId.has(s.id) ? [ordersBySeatId.get(s.id)] : [],
      })),
    };
  }

  // Public/customer shape: no orders, no PII. Only look up order ownership
  // (for `isMine`) when the caller is a signed-in customer at all.
  const latestBySeatId = userId ? await latestActiveOrdersBySeatId(prisma, seatIds) : new Map();
  return {
    layoutKey: loc?.layoutKey ?? null,
    layoutMirror: loc?.layoutMirror ?? false,
    seats: seats.map((s) => {
      const seat = baseSeat(s);
      const order = latestBySeatId.get(s.id);
      if (order && order.userId && order.userId === userId) seat.isMine = true;
      return seat;
    }),
  };
}

/**
 * Task A8b: who's asking, resolved without ever failing the request - these
 * seat routes are public, so an optional auth check must never turn into a
 * 401. `isStaff` is true for an admin (session or `x-admin-api-key`, see
 * `auth/admin.js` `checkAdminAuth`) OR a kiosk device key scoped to THIS
 * `locationId` (see `auth/kiosk.js` `deviceFor`) - a kiosk key for a
 * different location does not count on its own, but (fix round 1) never
 * overrides a valid admin credential sent alongside it: the two grants are
 * independent, not an either/or. `userId` is the caller's verified database
 * user id (see `auth/customer.js` `resolve`), or null.
 *
 * `deps`: `{ checkAdminAuth(req), kioskDeviceFor(req), resolveCustomer(req) }`,
 * each already bound to the live auth instances the route registers.
 */
export async function resolveSeatViewer(req, locationId, deps) {
  const [admin, kioskDevice, customer] = await Promise.all([
    deps.checkAdminAuth ? deps.checkAdminAuth(req) : null,
    deps.kioskDeviceFor ? deps.kioskDeviceFor(req) : null,
    deps.resolveCustomer ? deps.resolveCustomer(req) : null,
  ]);
  const isStaff = Boolean(admin) || Boolean(kioskDevice && kioskDevice.locationId === locationId);
  const userId = customer && customer.kind === "user" ? (customer.userId ?? null) : null;
  return { isStaff, userId };
}
