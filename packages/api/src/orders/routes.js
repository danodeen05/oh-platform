/**
 * Order routes (Task A6), on the shared order service (./service.js).
 *
 *   POST /orders                         create (customer auth, or kiosk device auth)
 *   POST /orders/quote                   same body, returns the server quote, writes nothing
 *   POST /orders/:id/payment-intent      {clientSecret} for order.amountDueCents
 *                                        (optional savings in the body re-quote the unpaid order first)
 *   POST /orders/:id/confirm-payment     {paymentIntentId?} -> order, PAID only once verified
 *   PATCH /orders/:id                    status / arrival / pod fields only; payment fields are refused
 *   POST /orders/:id/apply-credits       sets the owner's credits on the quote (spent at PAID)
 *   POST /kiosk/orders/payment-intent    kiosk device: one Terminal PaymentIntent for its orders
 *   POST /kiosk/orders/confirm-payment   kiosk device: {paymentIntentId?, orderIds} -> orders
 *
 * Registered after withStatusDemo() wraps prisma and after
 * registerStatusDemoGuard(), so every write naming a demo order is answered
 * by the demo guard before it reaches a handler here.
 */
import { orderOwnerId } from "../auth/customer.js";
import { onOrderCompleted as engineOnOrderCompleted } from "../membership/engine.js";
import { notifyTierUpIfNeeded } from "../notifications.js";
import { canSeeFullOrder, safeOrderView } from "./order-view.js";
import {
  quoteOrder,
  createOrder,
  requoteOrder,
  createPaymentIntent,
  markPaid,
  markPaidBatch,
  createKioskPaymentIntent,
  OrderError,
  DINE_IN_DISABLED_MESSAGE,
} from "./service.js";

const ORDER_INCLUDE = {
  items: { include: { menuItem: true } },
  seat: true,
  location: true,
  user: true,
  guest: true,
};

/** Fields PATCH /orders/:id accepts. Anything else, notably payment and price fields, is a 400. */
const PATCHABLE = new Set([
  "status",
  "userId",
  "guestId",
  "estimatedArrival",
  "seatId",
  "podSelectionMethod",
  "podAssignedAt",
  "podConfirmedAt",
  "podReservationExpiry",
  "orderSource",
]);

const SAVINGS_KEYS = ["useCreditsCents", "promoCode", "giftCardCode", "mealGiftId", "rewardId"];

function sendOrderError(reply, err) {
  if (!(err instanceof OrderError)) {
    // An unexpected failure after a verified charge was refunded (service.js
    // refundOnFailure): still a 500, but tell the client its card is whole.
    if (err && err.refunded !== undefined) {
      console.error("[orders] settle failed after a verified charge:", err?.message || err);
      return reply.code(500).send({ error: "PAYMENT_NOT_APPLIED", message: "Payment could not be applied.", refunded: err.refunded });
    }
    throw err;
  }
  if (err.code === "DINE_IN_DISABLED") return reply.code(403).send({ error: DINE_IN_DISABLED_MESSAGE, code: err.code });
  return reply.code(err.status).send({ error: err.code, message: err.message, ...err.extra });
}

function bearerOf(req) {
  const h = req.headers?.authorization;
  return typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

function seatRequestFrom(body) {
  const seat = body.seat && typeof body.seat === "object" ? body.seat : null;
  if (seat?.label && typeof seat.label === "string") return { label: seat.label };
  if (seat?.best) return { best: true };
  // Legacy web/kiosk callers send the chosen pod's id.
  if (typeof body.seatId === "string" && body.seatId) return { seatId: body.seatId, dual: Boolean(body.isDualPod) };
  return null;
}

function partySizeFrom(body) {
  const n = Number(body.partySize);
  if (Number.isInteger(n) && n >= 1 && n <= 8) return n;
  return body.isDualPod ? 2 : 1;
}

export async function registerOrderRoutes(app, {
  prisma,
  stripe,
  customerAuth,
  kioskAuth,
  checkAdminAuth,
  isDineInOrdersEnabled = () => true,
  effects,
  onOrderCompleted = engineOnOrderCompleted,
  now = () => new Date(),
}) {
  /**
   * Task A8b, fix round 2: `POST /orders/:id/confirm-payment` and
   * `PATCH /orders/:id` are public (both are hit before/without a session in
   * some flows - a Stripe redirect return, a guest checkout, the webhook)
   * and used to return the full order, including `user`/`guest` contact
   * fields, to anyone who could produce a valid request. Same rule as
   * `GET /orders/:id` (`orders/order-view.js`): the verified owner, staff,
   * or a kiosk device for the order's own location see the full order;
   * everyone else gets `safeOrderView`.
   */
  async function viewerCanSeeFull(req, order) {
    return canSeeFullOrder(req, order, {
      checkAdminAuth,
      kioskDeviceFor: kioskAuth ? kioskAuth.deviceFor : undefined,
      resolveCustomer: (r) => customerAuth.resolve(r),
      findGuestBySessionToken: (token) => prisma.guest.findUnique({ where: { sessionToken: token } }),
    });
  }

  /** The kiosk device behind a `Bearer kiosk_...` key; a bad key is a 401 (never falls through to customer). */
  async function kioskDevice(req, reply) {
    const token = bearerOf(req);
    if (!token || !token.startsWith("kiosk_")) return { device: null };
    const device = kioskAuth ? await kioskAuth.deviceFor(req) : null;
    if (!device) {
      reply.code(401).send({ error: "Kiosk device not authorized" });
      return { denied: true };
    }
    return { device };
  }

  async function requireDevice(req, reply) {
    const { device, denied } = await kioskDevice(req, reply);
    if (denied) return null;
    if (!device) {
      reply.code(401).send({ error: "Kiosk device not authorized" });
      return null;
    }
    return device;
  }

  async function quoteInput(req, reply, body) {
    const { device, denied } = await kioskDevice(req, reply);
    if (denied) return null;
    let locationId = body.locationId;
    if (device) {
      if (locationId && locationId !== device.locationId) {
        reply.code(403).send({ error: "ORDER_WRONG_LOCATION", message: "A kiosk orders for its own location only." });
        return null;
      }
      locationId = device.locationId;
    }
    // The owner is the verified caller only; a body userId is ignored. Kiosk and guests get null.
    const userId = device ? null : orderOwnerId(await customerAuth.resolve(req));
    return {
      device,
      userId,
      args: {
        locationId,
        items: body.items,
        userId,
        promoCode: body.promoCode,
        useCreditsCents: body.useCreditsCents,
        rewardId: body.rewardId,
        giftCardCode: body.giftCardCode,
        mealGiftId: body.mealGiftId,
        now: now(),
      },
    };
  }

  const fullOrder = (id) => prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });

  app.post("/orders/quote", async (req, reply) => {
    const input = await quoteInput(req, reply, req.body || {});
    if (!input) return reply;
    try {
      return await quoteOrder(prisma, input.args);
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.post("/orders", async (req, reply) => {
    // Dine-in ordering toggle (Tenant.dineInOrdersEnabled, admin "Order Now").
    if (!isDineInOrdersEnabled()) {
      return reply.code(403).send({ error: DINE_IN_DISABLED_MESSAGE, code: "DINE_IN_DISABLED" });
    }
    const body = req.body || {};
    const input = await quoteInput(req, reply, body);
    if (!input) return reply;
    try {
      const quote = await quoteOrder(prisma, input.args);
      const order = await createOrder(prisma, {
        quote,
        locationId: input.args.locationId,
        tenantId: body.tenantId || null,
        userId: input.userId,
        guestId: typeof body.guestId === "string" ? body.guestId : null,
        guestName: typeof body.guestName === "string" ? body.guestName.slice(0, 80) : null,
        estimatedArrival: body.estimatedArrival || null,
        seatRequest: seatRequestFrom(body),
        partySize: partySizeFrom(body),
        source: input.device ? "KIOSK" : "WEB",
        now: input.args.now,
        isDineInOrdersEnabled,
      });
      const full = await fullOrder(order.id);
      return { ...full, quote: { discounts: quote.discounts, warnings: quote.warnings } };
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.post("/orders/:id/payment-intent", async (req, reply) => {
    const { id } = req.params;
    const body = req.body || {};
    const userId = orderOwnerId(await customerAuth.resolve(req));
    try {
      const changes = {};
      for (const k of SAVINGS_KEYS) if (Object.prototype.hasOwnProperty.call(body, k)) changes[k] = body[k];
      let warnings = [];
      if (Object.keys(changes).length > 0) {
        warnings = (await requoteOrder(prisma, { orderId: id, userId, changes, now: now() })).quote.warnings;
      }
      const pi = await createPaymentIntent(prisma, stripe, { orderId: id, userId, savePaymentMethod: Boolean(body.savePaymentMethod), now: now() });
      const order = await prisma.order.findUnique({ where: { id } });
      return {
        ...pi,
        warnings,
        totals: {
          subtotalCents: order.subtotalCents,
          promoDiscountCents: order.promoDiscountCents,
          rewardDiscountCents: order.rewardDiscountCents,
          taxCents: order.taxCents,
          totalCents: order.totalCents,
          creditsAppliedCents: order.creditsAppliedCents,
          mealGiftAppliedCents: order.mealGiftAppliedCents,
          giftCardAppliedCents: order.giftCardAppliedCents,
          amountDueCents: order.amountDueCents,
        },
      };
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.post("/orders/:id/confirm-payment", async (req, reply) => {
    const { id } = req.params;
    const { paymentIntentId = null } = req.body || {};
    try {
      // Safe for any caller: nothing is marked PAID unless Stripe (or a
      // server-verified zero balance) says so. The Stripe webhook uses it too.
      const result = await markPaid(prisma, stripe, { orderId: id, paymentIntentId, now: now() }, effects);
      const full = await fullOrder(id);
      const view = (await viewerCanSeeFull(req, full)) ? full : safeOrderView(full);
      return { ...view, alreadyPaid: result.alreadyPaid };
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.post("/orders/:id/apply-credits", async (req, reply) => {
    const { id } = req.params;
    const body = req.body || {};
    // Credits are the verified caller's own; a body userId must match it.
    const who = await customerAuth.requireUser(req, reply);
    if (!who) return reply;
    if (body.userId && body.userId !== who.userId) return reply.code(403).send({ error: "Forbidden" });
    try {
      const { order, quote } = await requoteOrder(prisma, { orderId: id, userId: who.userId, changes: { useCreditsCents: body.creditsCents }, now: now() });
      return { appliedCredits: order.creditsAppliedCents, newTotal: order.amountDueCents, amountDueCents: order.amountDueCents, warnings: quote.warnings };
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.patch("/orders/:id", async (req, reply) => {
    const { id } = req.params;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const unknown = Object.keys(body).filter((k) => !PATCHABLE.has(k));
    if (unknown.length) {
      // paymentStatus, totalCents, taxCents, promo and Stripe fields are the
      // server's alone (POST /orders/:id/confirm-payment); never client input.
      return reply.code(400).send({ error: `unknown field: ${unknown.join(", ")}` });
    }
    const { status, userId, guestId, estimatedArrival, seatId, podSelectionMethod, podAssignedAt, podConfirmedAt, podReservationExpiry, orderSource } = body;

    const current = await prisma.order.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: "Order not found" });

    // Only a paid order may enter the kitchen flow; an unpaid one can only be cancelled.
    if (status && status !== "CANCELLED" && current.paymentStatus !== "PAID") {
      return reply.code(409).send({ error: "ORDER_NOT_PAID", message: "This order isn't paid yet." });
    }
    // An order can only be claimed by the verified caller, and only if it has no owner yet.
    if (userId) {
      const me = orderOwnerId(await customerAuth.resolve(req));
      if (!me || me !== userId || (current.userId && current.userId !== me)) return reply.code(403).send({ error: "Forbidden" });
    }

    const data = {};
    if (status) data.status = status;
    if (userId) data.userId = userId;
    if (guestId) data.guestId = guestId;
    if (estimatedArrival) data.estimatedArrival = new Date(estimatedArrival);
    if (seatId) data.seatId = seatId;
    if (podSelectionMethod) data.podSelectionMethod = podSelectionMethod;
    if (podAssignedAt) data.podAssignedAt = new Date(podAssignedAt);
    if (podConfirmedAt) data.podConfirmedAt = new Date(podConfirmedAt);
    if (podReservationExpiry) data.podReservationExpiry = new Date(podReservationExpiry);
    if (orderSource) data.orderSource = orderSource;
    if (!Object.keys(data).length) {
      return reply.code(400).send({ error: "status, userId, guestId, estimatedArrival, seatId or a pod field required" });
    }

    await prisma.order.update({ where: { id }, data });
    const order = await fullOrder(id);

    // Customer confirmed arrival at the pod: seat(s) OCCUPIED.
    if (podConfirmedAt && order.seatId) {
      const seats = [order.seatId, ...(order.isDualPod && order.dualPartnerSeatId ? [order.dualPartnerSeatId] : [])];
      await prisma.seat.updateMany({ where: { id: { in: seats } }, data: { status: "OCCUPIED" } });
    }

    // An abandoned checkout gives its held pod back.
    if (status === "CANCELLED" && current.paymentStatus !== "PAID" && current.seatId) {
      const seats = [current.seatId, ...(current.isDualPod && current.dualPartnerSeatId ? [current.dualPartnerSeatId] : [])];
      await prisma.seat.updateMany({ where: { id: { in: seats }, status: "RESERVED" }, data: { status: "AVAILABLE" } });
    }

    // Membership payouts only on a real transition into COMPLETED.
    if (status === "COMPLETED" && current.status !== "COMPLETED") {
      const membershipResult = await onOrderCompleted(prisma, { orderId: id, now: now() });
      // Task F2: tier-up SMS after the membership transaction has committed.
      if (membershipResult?.upgradedTo) {
        notifyTierUpIfNeeded(prisma, { userId: order.userId, upgradedTo: membershipResult.upgradedTo }).catch((err) =>
          console.error("[orders] tier-up notify failed:", err?.message || err),
        );
      }
    }
    return (await viewerCanSeeFull(req, order)) ? order : safeOrderView(order);
  });

  app.post("/kiosk/orders/payment-intent", async (req, reply) => {
    const device = await requireDevice(req, reply);
    if (!device) return reply;
    const body = req.body || {};
    try {
      return await createKioskPaymentIntent(prisma, stripe, { orderIds: body.orderIds, locationId: device.locationId, terminal: body.terminal !== false, now: now() });
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.post("/kiosk/orders/confirm-payment", async (req, reply) => {
    const device = await requireDevice(req, reply);
    if (!device) return reply;
    const body = req.body || {};
    try {
      return await markPaidBatch(prisma, stripe, { orderIds: body.orderIds, paymentIntentId: body.paymentIntentId || null, locationId: device.locationId, now: now() }, effects);
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });
}
