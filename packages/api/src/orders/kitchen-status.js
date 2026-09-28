/**
 * Order status changes from the kitchen, the cleaning display and the
 * guest (Task D5 fix round 2). Moved out of index.js so it can be tested.
 *
 *   PATCH /kitchen/orders/:id/status   staff (any console role: owner,
 *                                      manager, station) or a kiosk device
 *                                      at the order's own location. Any status.
 *   POST  /orders/:id/done             the verified owner (signed-in member,
 *                                      or the guest session that owns a
 *                                      guest order): SERVING -> COMPLETED only.
 *                                      The status page's "I'm done eating".
 *
 * Before this, the PATCH was anonymous: anyone with an order id could set
 * COMPLETED (paying cashback and referral rewards early) or CANCELLED on a
 * paid order (bypassing the refund flow).
 *
 * COMPLETED runs the membership engine once per real transition (idempotent
 * per order), frees the pod for cleaning, and `onCompleted` lets index.js
 * refresh the wallet pass and send the tier-up SMS.
 */
import { canSeeFullOrder, safeOrderView } from "./order-view.js";
import { GUEST_SESSION_HEADER } from "./group-routes.js";

export const KITCHEN_STATUSES = Object.freeze(["QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED", "CANCELLED"]);

const ORDER_INCLUDE = { items: { include: { menuItem: true } }, seat: true, location: true, user: true };

/**
 * Writes a status with its timestamps and runs the side effects (the old
 * handler's body). With `fromStatus`, the write is conditional (only from
 * that status) and returns null when the order had already moved on.
 */
export async function applyOrderStatus(prisma, { id, status, fromStatus = null, now = new Date(), onOrderCompleted, onCompleted = () => {} }) {
  const data = { status };
  if (status === "PREPPING") data.prepStartTime = now;
  if (status === "READY") data.readyTime = now;
  if (status === "SERVING") data.deliveredAt = now;
  if (status === "COMPLETED") data.completedTime = now;

  // Only a real transition into COMPLETED runs the membership engine.
  const wasAlreadyCompleted =
    status === "COMPLETED" ? (await prisma.order.findUnique({ where: { id }, select: { status: true } }))?.status === "COMPLETED" : true;

  if (fromStatus) {
    const moved = await prisma.order.updateMany({ where: { id, status: fromStatus }, data });
    if (moved.count !== 1) return null;
  }
  const order = fromStatus
    ? await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
    : await prisma.order.update({ where: { id }, data, include: ORDER_INCLUDE });

  // The pod is OCCUPIED for active orders (QUEUED through SERVING).
  if (order.seatId && ["QUEUED", "PREPPING", "READY", "SERVING"].includes(status)) {
    if (order.seat && order.seat.status !== "OCCUPIED") {
      await prisma.seat.update({ where: { id: order.seatId }, data: { status: "OCCUPIED" } });
    }
  }
  // A finished order's pod goes to cleaning; staff mark it AVAILABLE (/seats/:id/clean).
  if (status === "COMPLETED" && order.seatId) {
    await prisma.seat.update({ where: { id: order.seatId }, data: { status: "CLEANING" } });
  }
  if (status === "COMPLETED" && !wasAlreadyCompleted && onOrderCompleted) {
    const result = await onOrderCompleted(prisma, { orderId: order.id, now });
    await Promise.resolve(onCompleted(order, result)).catch(() => undefined);
  }
  return order;
}

export function registerKitchenStatusRoutes(app, { prisma, checkAdminAuth, kioskAuth, customerAuth, onOrderCompleted, onCompleted, now = () => new Date() }) {
  const viewerDeps = {
    checkAdminAuth,
    kioskDeviceFor: kioskAuth ? (req) => kioskAuth.deviceFor(req) : undefined,
    resolveCustomer: (req) => customerAuth.resolve(req),
    findGuestBySessionToken: (token) => prisma.guest.findUnique({ where: { sessionToken: token } }),
  };
  const view = async (req, order) => ((await canSeeFullOrder(req, order, viewerDeps)) ? order : safeOrderView(order));

  /** Staff (any console role) or a kiosk device at the order's location. */
  async function isFloor(req, order) {
    const [admin, device] = await Promise.all([checkAdminAuth ? checkAdminAuth(req) : null, kioskAuth ? kioskAuth.deviceFor(req) : null]);
    return Boolean(admin) || Boolean(device && device.locationId === order.locationId);
  }

  /** The verified owner: the signed-in member, or the guest session that owns a guest order. Never staff. */
  async function isOwner(req, order) {
    const who = await customerAuth.resolve(req);
    if (who && who.kind === "user" && who.userId && who.userId === order.userId) return true;
    if (!order.userId && order.guestId) {
      const token = req.headers?.[GUEST_SESSION_HEADER];
      if (typeof token === "string" && token) {
        const guest = await prisma.guest.findUnique({ where: { sessionToken: token } });
        if (guest && guest.id === order.guestId && new Date(guest.expiresAt) > now()) return true;
      }
    }
    return false;
  }

  function hasCredential(req) {
    return Boolean(req.headers?.authorization || req.headers?.["x-admin-api-key"] || req.headers?.[GUEST_SESSION_HEADER]);
  }

  app.patch("/kitchen/orders/:id/status", async (req, reply) => {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return reply.code(400).send({ error: "status required" });
    if (!KITCHEN_STATUSES.includes(status)) return reply.code(400).send({ error: "INVALID_STATUS", message: "Unknown status." });
    const current = await prisma.order.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: "Order not found" });
    if (!(await isFloor(req, current))) {
      return reply
        .code(hasCredential(req) ? 403 : 401)
        .send({ error: hasCredential(req) ? "FORBIDDEN" : "UNAUTHORIZED", message: "Only staff can change an order's status." });
    }
    const order = await applyOrderStatus(prisma, { id, status, now: now(), onOrderCompleted, onCompleted });
    return view(req, order);
  });

  app.post("/orders/:id/done", async (req, reply) => {
    const { id } = req.params;
    const current = await prisma.order.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: "Order not found" });
    if (!(await isOwner(req, current))) {
      return reply
        .code(hasCredential(req) ? 403 : 401)
        .send({ error: hasCredential(req) ? "FORBIDDEN" : "UNAUTHORIZED", message: "Only the order's owner can finish it." });
    }
    if (current.status === "COMPLETED") return view(req, await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE }));
    if (current.status !== "SERVING") return reply.code(409).send({ error: "ORDER_NOT_SERVING", message: "Your bowl hasn't been served yet." });
    // Conditional (SERVING only), so a concurrent kitchen change is never overwritten.
    const order = await applyOrderStatus(prisma, { id, status: "COMPLETED", fromStatus: "SERVING", now: now(), onOrderCompleted, onCompleted });
    if (!order) return reply.code(409).send({ error: "ORDER_NOT_SERVING", message: "Your bowl hasn't been served yet." });
    return view(req, order);
  });
}
