/**
 * Shop order routes (moved out of index.js in Task D10a).
 *
 *   POST  /shop/orders                       unpaid, server-priced order for the verified member or guest session
 *                                            (savings recorded, spent only when PAID; fix round 1)
 *   PATCH /shop/orders/:id                   staff fulfillment fields only (console-guard STAFF)
 *   POST  /shop/orders/:id/apply-credits     member credit on an UNPAID order (console-guard OWNER)
 *   POST  /shop/orders/:id/confirm-payment   verified PaymentIntent -> PAID (owner, guest session, or the webhook's ADMIN_API_KEY)
 *
 * The shop PaymentIntent itself is POST /create-payment-intent {kind: "shop_order", shopOrderId}
 * (orders/purchase-intents.js). Payment status and totals are never client input.
 * Registered after the console guard and the customer identity hooks, as in index.js.
 */
import { orderOwnerId } from "../auth/customer.js";
import { shopCreditSpender } from "../auth/hardening.js";
import { GUEST_SESSION_HEADER } from "../orders/group-routes.js";
import { OrderError } from "../orders/service.js";
import { createShopOrder, applyShopCredits, confirmShopPayment } from "./service.js";

/** PATCH /shop/orders/:id may set these, and nothing else. */
export const SHOP_ORDER_PATCH_FIELDS = Object.freeze(["fulfillmentStatus", "trackingNumber", "trackingUrl", "shippedAt", "deliveredAt", "pickedUpAt"]);
const FULFILLMENT_STATUSES = new Set(["PENDING", "PROCESSING", "SHIPPED", "READY_PICKUP", "COMPLETED", "CANCELLED"]);

/** Client fields POST /shop/orders refuses outright: payment is only ever verified by the server. */
const FORBIDDEN_CREATE_FIELDS = ["paymentStatus", "stripePaymentId"];

function sendError(reply, err) {
  if (err instanceof OrderError) return reply.status(err.status).send({ error: err.code, message: err.message, ...err.extra });
  throw err;
}

/**
 * Who may act on a shop order (its PaymentIntent, its confirm): the verified
 * member who owns it, the guest whose unexpired session token (x-guest-session)
 * owns it, or a trusted server-to-server caller (x-admin-api-key, the Stripe
 * webhook). Returns "service" | "owner" | "guest", or { status } to refuse.
 */
export function makeShopOrderAccess({ customerAuth, findGuestBySessionToken, now = () => new Date() }) {
  return async function shopOrderAccess(req, order) {
    if (customerAuth.isServiceCall(req)) return "service";
    const who = await customerAuth.resolve(req);
    const me = orderOwnerId(who);
    if (order.userId) {
      if (me && me === order.userId) return "owner";
      return { status: me ? 403 : 401 };
    }
    if (order.guestId) {
      const token = req.headers?.[GUEST_SESSION_HEADER];
      if (typeof token === "string" && token) {
        const guest = await findGuestBySessionToken(token);
        if (guest && guest.id === order.guestId && new Date(guest.expiresAt) > now()) return "guest";
      }
      return { status: 403 };
    }
    return { status: 403 };
  };
}

/** The verified guest behind x-guest-session, or null. */
async function sessionGuest(req, findGuestBySessionToken, now) {
  const token = req.headers?.[GUEST_SESSION_HEADER];
  if (typeof token !== "string" || !token) return null;
  const guest = await findGuestBySessionToken(token);
  return guest && new Date(guest.expiresAt) > now() ? guest : null;
}

export async function registerShopOrderRoutes(app, { prisma, stripe, customerAuth, onShopOrderPaid = async () => {}, now = () => new Date() }) {
  const findGuestBySessionToken = (token) => prisma.guest.findUnique({ where: { sessionToken: token } });
  const shopOrderAccess = makeShopOrderAccess({ customerAuth, findGuestBySessionToken, now });
  const paid = (order) => {
    Promise.resolve()
      .then(() => onShopOrderPaid(order))
      .catch((err) => console.error("Shop order paid effects failed:", err?.message || err));
  };

  // Create a shop order. Owner: the verified member, else the guest session.
  app.post("/shop/orders", async (req, reply) => {
    try {
      const body = req.body || {};
      const forbidden = FORBIDDEN_CREATE_FIELDS.filter((f) => body[f] !== undefined && body[f] !== null);
      if (forbidden.length) return reply.status(400).send({ error: "FORBIDDEN_FIELD", message: `not accepted: ${forbidden.join(", ")}` });

      const who = await customerAuth.resolve(req);
      const userId = orderOwnerId(who);
      const guest = userId ? null : await sessionGuest(req, findGuestBySessionToken, now);
      if (!userId && !guest) {
        return reply.status(401).send({ error: "SIGN_IN_REQUIRED", message: "Sign in or continue as a guest to check out." });
      }
      let order;
      try {
        order = await createShopOrder(prisma, {
          owner: { userId, guestId: guest?.id || null },
          items: body.items,
          fulfillmentType: body.fulfillmentType,
          shipping: body.shipping || null,
          locationId: typeof body.locationId === "string" ? body.locationId : null,
          creditsToApply: body.creditsToApply,
          // A gift card is named by its code (the secret), never a bare id.
          giftCardCode: typeof body.giftCardCode === "string" ? body.giftCardCode : null,
          now: now(),
        });
      } catch (err) {
        return sendError(reply, err);
      }
      if (order.paymentStatus === "PAID") paid(order);
      return reply.send(order);
    } catch (error) {
      console.error("Error creating shop order:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Staff: fulfillment and tracking only. Payment status and totals are never settable here.
  app.patch("/shop/orders/:id", async (req, reply) => {
    try {
      const updates = req.body && typeof req.body === "object" ? req.body : {};
      const unknown = Object.keys(updates).filter((k) => !SHOP_ORDER_PATCH_FIELDS.includes(k));
      if (unknown.length) return reply.status(400).send({ error: "UNKNOWN_FIELD", message: `unknown field: ${unknown.join(", ")}` });
      if (updates.fulfillmentStatus !== undefined && !FULFILLMENT_STATUSES.has(updates.fulfillmentStatus)) {
        return reply.status(400).send({ error: "INVALID_FULFILLMENT_STATUS" });
      }
      const data = {};
      for (const field of SHOP_ORDER_PATCH_FIELDS) if (updates[field] !== undefined) data[field] = updates[field];

      const existing = await prisma.shopOrder.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(404).send({ error: "Order not found" });
      const order = await prisma.shopOrder.update({ where: { id: req.params.id }, data });
      return reply.send(order);
    } catch (error) {
      console.error("Error updating shop order:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Member credit on an unpaid order (409 ORDER_NOT_PENDING otherwise). A body userId is ignored.
  app.post("/shop/orders/:id/apply-credits", async (req, reply) => {
    try {
      const who = await customerAuth.requireUser(req, reply);
      if (!who) return reply;
      const order = await prisma.shopOrder.findUnique({ where: { id: req.params.id } });
      const verdict = shopCreditSpender(who, order);
      if (verdict.status) return reply.status(verdict.status).send({ error: verdict.error });
      try {
        const result = await applyShopCredits(prisma, { orderId: order.id, userId: verdict.userId, amountCents: req.body?.amountCents, now: now() });
        if (result.order.paymentStatus === "PAID") paid(result.order);
        return reply.send({ success: true, creditsApplied: result.creditsApplied, newTotal: result.order.totalCents, paymentStatus: result.order.paymentStatus });
      } catch (err) {
        return sendError(reply, err);
      }
    } catch (error) {
      console.error("Error applying credits to shop order:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Verified payment: the Stripe webhook (ADMIN_API_KEY) and the store's return page.
  app.post("/shop/orders/:id/confirm-payment", async (req, reply) => {
    try {
      const order = await prisma.shopOrder.findUnique({ where: { id: req.params.id } });
      if (!order) return reply.status(404).send({ error: "NOT_FOUND" });
      const access = await shopOrderAccess(req, order);
      if (typeof access === "object") return reply.status(access.status).send({ error: access.status === 401 ? "SIGN_IN_REQUIRED" : "FORBIDDEN" });
      const paymentIntentId = req.body?.paymentIntentId;
      if (typeof paymentIntentId !== "string" || !paymentIntentId) return reply.status(400).send({ error: "PAYMENT_INTENT_REQUIRED" });
      let result;
      try {
        result = await confirmShopPayment(prisma, stripe, { orderId: order.id, paymentIntentId, now: now() });
      } catch (err) {
        return sendError(reply, err);
      }
      if (!result.alreadyPaid) paid(result.order);
      const o = result.order;
      return reply.send({ alreadyPaid: result.alreadyPaid, id: o.id, orderNumber: o.orderNumber, paymentStatus: o.paymentStatus, totalCents: o.totalCents });
    } catch (error) {
      console.error("Error confirming shop payment:", error);
      return reply.status(500).send({ error: error.message });
    }
  });

  return { shopOrderAccess };
}
