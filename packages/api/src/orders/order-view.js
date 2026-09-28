/**
 * Task A8b, fix round 1: GET /orders/:id is public and had no ownership
 * check at all - it returned `user: {id, name, email, phone, smsOptIn}` for
 * ANY order id. Only the verified owner, staff, or a verified guest owner
 * may see the full order (including user/guest contact fields); everyone
 * else gets the safe status view below.
 *
 * "Staff" mirrors the seat routes (Task A8b, `seats/service.js`): an admin
 * (session or `x-admin-api-key`) or a kiosk device key scoped to the
 * order's OWN location - never a 401, this route stays public either way.
 * A guest owner is proven the same way group orders already prove one
 * (`orders/group-routes.js`, `GUEST_SESSION_HEADER`): a server-issued,
 * unexpired `Guest.sessionToken` sent as `x-guest-session`, matching
 * `order.guestId` - never a client-sent guestId.
 */
import { GUEST_SESSION_HEADER } from "./group-routes.js";

/**
 * Task A8b, fix round 1 addendum: `GET /orders/lookup` and `GET
 * /orders/status` have their own, smaller hand-built shapes (a lookup
 * summary and a status-page summary) that never returned email or phone,
 * but did return a customer's or guest's FULL name to any caller. The
 * ceiling for an unverified caller is a first name - `firstNameOnly` gives
 * exactly that, or null.
 */
export function firstNameOnly(fullName) {
  if (typeof fullName !== "string" || !fullName.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

/**
 * True when `req` may see the full order (including user/guest contact
 * fields): the verified signed-in owner, staff, or - for a guest order (no
 * `userId`) - the verified guest session matching `order.guestId`.
 *
 * `deps`: `{ checkAdminAuth(req), kioskDeviceFor(req), resolveCustomer(req),
 * findGuestBySessionToken(token) }`, each already bound to the live auth
 * instances the route registers (same shape as `seats/service.js`
 * `resolveSeatViewer`'s `deps`, plus `findGuestBySessionToken`).
 */
export async function canSeeFullOrder(req, order, deps, now = () => new Date()) {
  const [admin, kioskDevice, customer] = await Promise.all([
    deps.checkAdminAuth ? deps.checkAdminAuth(req) : null,
    deps.kioskDeviceFor ? deps.kioskDeviceFor(req) : null,
    deps.resolveCustomer ? deps.resolveCustomer(req) : null,
  ]);
  if (admin) return true;
  if (kioskDevice && kioskDevice.locationId === order.locationId) return true;
  if (customer && customer.kind === "user" && customer.userId && customer.userId === order.userId) return true;

  if (!order.userId && order.guestId && deps.findGuestBySessionToken) {
    const token = req.headers?.[GUEST_SESSION_HEADER];
    if (typeof token === "string" && token) {
      const guest = await deps.findGuestBySessionToken(token);
      if (guest && guest.id === order.guestId && new Date(guest.expiresAt) > now()) return true;
    }
  }
  return false;
}

/**
 * The safe (anonymous/unverified) view of an order: status, number, items
 * with menuItem names, totals, location, pod label and timestamps. NO user
 * or guest contact fields (name, email, phone, sms consent) - not even a
 * first name; none of today's callers of GET /orders/:id need one without
 * ownership or staff (see the confirmation, payment and kiosk check-in
 * pages).
 */
export function safeOrderView(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    kitchenOrderNumber: order.kitchenOrderNumber ?? null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalCents: order.totalCents,
    taxCents: order.taxCents ?? null,
    subtotalCents: order.subtotalCents ?? null,
    groupOrderId: order.groupOrderId ?? null,
    locationId: order.locationId ?? null,
    location: order.location
      ? {
          id: order.location.id,
          name: order.location.name,
          city: order.location.city ?? null,
          timezone: order.location.timezone ?? null,
          taxRate: order.location.taxRate ?? null,
        }
      : null,
    seatId: order.seatId ?? null,
    seat: order.seat ? { id: order.seat.id, label: order.seat.label ?? null, number: order.seat.number ?? null } : null,
    items: (order.items || []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      priceCents: item.priceCents,
      selectedValue: item.selectedValue ?? null,
      menuItem: item.menuItem ? { id: item.menuItem.id, name: item.menuItem.name } : null,
    })),
    estimatedArrival: order.estimatedArrival ?? null,
    createdAt: order.createdAt ?? null,
    paidAt: order.paidAt ?? null,
    queuedAt: order.queuedAt ?? null,
    arrivedAt: order.arrivedAt ?? null,
    prepStartTime: order.prepStartTime ?? null,
    readyTime: order.readyTime ?? null,
    deliveredAt: order.deliveredAt ?? null,
    completedTime: order.completedTime ?? null,
  };
}

/**
 * GET /orders/lookup's "already checked in" summary (Task D11b). The order's
 * QR code is a credential (it checks the order in, starts its kitchen
 * ticket, calls staff to its pod, links a guest order to an account), and the
 * lookup is public by order number - so the code goes only to a caller who
 * `canSeeFull` (the verified owner, staff, or a kiosk at the order's own
 * location). Everyone else gets the rest of the summary with no code.
 */
export function arrivedLookupSummary(order, canSeeFull) {
  return {
    error: "Order already checked in",
    arrivedAt: order.arrivedAt,
    seatNumber: order.seat?.number,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      ...(canSeeFull ? { orderQrCode: order.orderQrCode } : {}),
      status: order.status,
      seatId: order.seatId,
      seat: order.seat, // Include full seat object for display
      totalCents: order.totalCents,
      guestName: canSeeFull ? order.guestName : firstNameOnly(order.guestName),
      items: order.items,
      user: order.user
        ? { name: canSeeFull ? order.user.name : firstNameOnly(order.user.name), membershipTier: canSeeFull ? order.user.membershipTier : undefined }
        : null,
    },
  };
}
