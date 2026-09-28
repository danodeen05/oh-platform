/**
 * Pod-service access (Task D6 fix round 1, the controller's rulings).
 *
 * A pod's QR code is printed on its table: anyone can scan it. So nothing a
 * pod scan returns may unlock an order, and every action on an order needs
 * EITHER the verified owner (Clerk member, or the guest session that owns a
 * guest order) OR proof of the ORDER's own QR code: the code the purchaser
 * got on their confirmation, receipt or text, never obtainable from the pod.
 * Kiosk orders can belong to guests who never signed in, so the code proof
 * is what they use (the pod page asks for it once and keeps it in session).
 *
 *   GET  /pods/info              pod label and status, whether an order is
 *                                waiting and whether it's confirmed. No order
 *                                code, id or user id, ever. An old sticker
 *                                (a retired pod with nothing live on it, Task
 *                                G3 fix round 1) is not an error: 200 with
 *                                `retired: true, code: POD_RETIRED` and the
 *                                pod's label/location only, same as any other
 *                                answer here.
 *   POST /pods/confirm-arrival   { podQrCode, orderQrCode? } confirms only the
 *                                caller's own order at that pod (owner, or the
 *                                matching order code). No "any order here"
 *                                fallback. A retired pod with no live legacy
 *                                order still on it answers 410 POD_RETIRED
 *                                before any order lookup runs.
 *   POST /orders/link-to-account { orderQrCode } a signed-in member claims an
 *                                UNLINKED order, with the order code as proof
 *                                (never the order id).
 *   Guard (preHandler) on POST /orders/:id/{call-staff, refill,
 *   extra-vegetables, dessert-ready, addons}: the owner, staff or a
 *   same-location kiosk (canSeeFullOrder), or the order code in the
 *   `x-order-code` header. Demo orders never get here: the status demo guard
 *   answers them first.
 *
 * Check-in (POST /orders/check-in) and pod confirm (POST /orders/confirm-pod)
 * were already keyed by the order code itself, which is the proof.
 */
import { canSeeFullOrder } from "./order-view.js";
import { GUEST_SESSION_HEADER } from "./group-routes.js";
import { localizeLocation } from "../i18n/localize.js";
import { retiredPodInfo, POD_RETIRED } from "../seats/free-pods.js";

export const ORDER_CODE_HEADER = "x-order-code";
const CLOSED = ["COMPLETED", "CANCELLED"];

export const SERVICE_ROUTES = new Set([
  "POST /orders/:id/call-staff",
  "POST /orders/:id/refill",
  "POST /orders/:id/extra-vegetables",
  "POST /orders/:id/dessert-ready",
  "POST /orders/:id/addons",
]);

/** The caller holds the order's own QR code (header, or `orderQrCode` in the body). */
export function hasOrderCodeProof(req, order) {
  if (!order?.orderQrCode) return false;
  const header = req.headers?.[ORDER_CODE_HEADER];
  const body = req.body && typeof req.body === "object" ? req.body.orderQrCode : undefined;
  return header === order.orderQrCode || body === order.orderQrCode;
}

/** The verified owner only: the Clerk member on the order, or the guest session that owns a guest order. */
export async function isVerifiedOwner(req, order, deps, now = () => new Date()) {
  const customer = deps.resolveCustomer ? await deps.resolveCustomer(req) : null;
  if (customer?.kind === "user" && customer.userId && customer.userId === order.userId) return true;
  if (!order.userId && order.guestId && deps.findGuestBySessionToken) {
    const token = req.headers?.[GUEST_SESSION_HEADER];
    if (typeof token === "string" && token) {
      const guest = await deps.findGuestBySessionToken(token);
      if (guest && guest.id === order.guestId && new Date(guest.expiresAt) > now()) return true;
    }
  }
  return false;
}

/** Who may use a pod service on an order: owner, staff, same-location kiosk, or the order-code holder. */
export async function canActOnOrder(req, order, deps) {
  if (hasOrderCodeProof(req, order)) return true;
  return canSeeFullOrder(req, order, deps);
}

export function registerOrderServiceGuard(app, { prisma, deps }) {
  app.addHook("preHandler", async (req, reply) => {
    const route = `${req.method} ${req.routeOptions?.url ?? req.routerPath ?? ""}`;
    if (!SERVICE_ROUTES.has(route)) return;
    const order = await prisma.order.findUnique({ where: { id: String(req.params?.id || "") } });
    if (!order) return reply.code(404).send({ error: "Order not found", code: "ORDER_NOT_FOUND" });
    if (!(await canActOnOrder(req, order, deps))) {
      return reply.code(403).send({ error: "Scan or enter your order code to use this.", code: "ORDER_CODE_REQUIRED" });
    }
  });
}

export function registerPodServiceRoutes(app, { prisma, deps, getLocale = () => "en", requireUser, now = () => new Date() }) {
  app.get("/pods/info", async (req, reply) => {
    const { qrCode } = req.query || {};
    if (!qrCode) return reply.code(400).send({ error: "qrCode required", code: "POD_CODE_REQUIRED" });
    const pod = await prisma.seat.findFirst({ where: { qrCode: String(qrCode) } });
    if (!pod) return reply.code(404).send({ error: "Pod not found", code: "POD_NOT_FOUND" });
    const location = pod.locationId ? await prisma.location.findUnique({ where: { id: pod.locationId } }) : null;
    const active = await prisma.order.findFirst({ where: { seatId: pod.id, paymentStatus: "PAID", status: { not: { in: CLOSED } } } });
    const named = location ? localizeLocation(location, getLocale(req)) : null;
    const namedLocation = location ? { id: location.id, name: named.name, city: location.city ?? null } : null;

    // Old sticker: a retired pod with nothing live on it (Task G3 fix round
    // 1). Still no order data, ever -- just the retired marker.
    if (retiredPodInfo(pod, active)) {
      return {
        retired: true,
        code: POD_RETIRED,
        pod: { label: pod.label || pod.number, status: "RETIRED" },
        location: namedLocation,
        hasActiveOrder: false,
        alreadyConfirmed: false,
      };
    }

    return {
      pod: { label: pod.label || pod.number, status: pod.status },
      // Where the pod is (for the map); nothing about any order.
      location: namedLocation,
      hasActiveOrder: Boolean(active),
      alreadyConfirmed: Boolean(active?.podConfirmedAt),
    };
  });

  app.post("/pods/confirm-arrival", async (req, reply) => {
    const { podQrCode, orderQrCode } = req.body || {};
    if (!podQrCode) return reply.code(400).send({ error: "podQrCode required", code: "POD_CODE_REQUIRED" });
    const pod = await prisma.seat.findFirst({ where: { qrCode: String(podQrCode) } });
    if (!pod) return reply.code(404).send({ error: "Pod not found. Please check the QR code.", code: "POD_NOT_FOUND" });

    if (pod.retiredAt) {
      // Old sticker: release 2 never assigns a retired pod, but a legacy
      // order already checked in on one before the cutover still finishes
      // here (Task G3 fix round 1). Nothing live on it means the sticker's
      // just out of date.
      const live = await prisma.order.findFirst({
        where: { seatId: pod.id, paymentStatus: "PAID", podConfirmedAt: null, status: { not: { in: CLOSED } } },
      });
      if (!live) {
        return reply.code(410).send({ error: "This pod code is out of date.", code: POD_RETIRED, locationId: pod.locationId });
      }
    }

    // The caller's own order only: the matching order code, or the verified owner.
    let order = null;
    if (typeof orderQrCode === "string" && orderQrCode) {
      const byCode = await prisma.order.findUnique({ where: { orderQrCode } });
      if (byCode && byCode.paymentStatus === "PAID" && !CLOSED.includes(byCode.status)) {
        if (byCode.seatId !== pod.id) return reply.code(409).send({ error: "That order is held at a different pod.", code: "WRONG_POD" });
        order = byCode;
      } else {
        return reply.code(404).send({ error: "We couldn't find that order.", code: "ORDER_NOT_FOUND" });
      }
    } else {
      const here = await prisma.order.findMany({ where: { seatId: pod.id, paymentStatus: "PAID", status: { not: { in: CLOSED } } } });
      for (const o of here) {
        if (await isVerifiedOwner(req, o, deps, now)) {
          order = o;
          break;
        }
      }
      if (!order) {
        // Someone else's order may be waiting here; never confirm it. The caller proves theirs with its code.
        return reply.code(403).send({ error: "Enter your order code to check in at this pod.", code: "ORDER_CODE_REQUIRED" });
      }
    }
    if (order.podConfirmedAt) return reply.code(409).send({ error: "You've already confirmed arrival at this pod", code: "ALREADY_CONFIRMED", order: { orderQrCode: order.orderQrCode } });

    const at = now();
    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: order.id },
        data: {
          podConfirmedAt: at,
          arrivedAt: order.arrivedAt || at,
          queuedAt: order.queuedAt || at,
          status: order.status === "PAID" ? "QUEUED" : order.status,
          paidAt: order.paidAt || at,
        },
      });
      await tx.seat.update({ where: { id: pod.id }, data: { status: "OCCUPIED" } });
      return o;
    });
    return {
      success: true,
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        kitchenOrderNumber: updated.kitchenOrderNumber,
        orderQrCode: updated.orderQrCode,
        podNumber: pod.label || pod.number,
        status: updated.status,
      },
    };
  });

  // Link a guest order to the signed-in caller's account. Identity comes from the verified session; the proof is the order code.
  app.post("/orders/link-to-account", async (req, reply) => {
    const { orderQrCode } = req.body || {};
    if (typeof orderQrCode !== "string" || !orderQrCode) return reply.code(400).send({ error: "orderQrCode required", code: "ORDER_CODE_REQUIRED" });
    const who = await requireUser(req, reply);
    if (!who) return reply;
    const order = await prisma.order.findUnique({ where: { orderQrCode } });
    if (!order) return reply.code(404).send({ error: "Order not found", code: "ORDER_NOT_FOUND" });
    if (order.userId) {
      if (order.userId === who.userId) return { success: true, message: "Order already linked to your account" };
      return reply.code(400).send({ error: "Order is already linked to another account", code: "ALREADY_LINKED" });
    }
    // Link only while still unlinked, so two racing requests cannot both claim it.
    const linked = await prisma.order.updateMany({ where: { id: order.id, userId: null }, data: { userId: who.userId } });
    if (linked.count === 0) return reply.code(400).send({ error: "Order is already linked to another account", code: "ALREADY_LINKED" });
    return { success: true, message: "Order linked successfully", pointsAwarded: Math.floor((order.totalCents || 0) / 100) };
  });
}
