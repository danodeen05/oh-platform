/**
 * Group order routes (Task A7; moved out of index.js).
 *
 *   POST   /group-orders                           create; the host is the verified caller
 *   GET    /group-orders/:code                     read (no guest session tokens, no member PII)
 *   POST   /group-orders/:code/join                join as the verified caller
 *   PATCH  /group-orders/:code                     host: close, cancel, choose who pays
 *   POST   /group-orders/:code/orders              add the caller's order (quoteOrder + createOrder)
 *   DELETE /group-orders/:code/orders/:orderId     the order's member or the host
 *   POST   /group-orders/:code/transfer-host       host: hand the host role to a member
 *   POST   /group-orders/:code/complete            host: every order paid -> pods + kitchen
 *   POST   /group-orders/:code/payment-intent      host (signed in): ONE PaymentIntent for the group
 *   POST   /group-orders/:code/confirm-payment     verified group settle: any caller with a
 *                                                  PaymentIntent (Stripe verifies it); the
 *                                                  host for a zero balance
 *
 * Identity. The acting member is never a client-sent id:
 *  - a member is the verified Clerk session (customerAuth, orderOwnerId);
 *  - a guest is proven by the server-issued Guest.sessionToken the web keeps
 *    in its guest cookie, sent as `x-guest-session`;
 *  - as with POST /orders, a bare body guestId is still accepted to join a
 *    group or add an order (the guest checkout row), but it is never enough
 *    for a host action or to remove someone's order.
 * Host actions need the verified host. Paying for everyone needs a signed-in
 * host: the group payment is a card charge tied to an account.
 *
 * Payment status is the server's alone: PATCH refuses PAID / PARTIALLY_PAID /
 * PAYING, orders become PAID only through markPaid (pay your own) or
 * markGroupPaid (host pays), both server-verified.
 */
import { orderOwnerId } from "../auth/customer.js";
import { quoteOrder, createOrder, createGroupPaymentIntent, markGroupPaid, OrderError, DINE_IN_DISABLED_MESSAGE } from "./service.js";

export const GUEST_SESSION_HEADER = "x-guest-session";
export const MAX_GROUP_MEMBERS = 8;
const GROUP_TTL_MS = 30 * 60 * 1000;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const CLIENT_STATUSES = new Set(["CLOSED", "CANCELLED"]);
const SERVER_STATUSES = new Set(["PAID", "PARTIALLY_PAID", "PAYING"]);

function generateGroupCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  return code;
}

/**
 * Task A8b, fix round 2 (+ addendum): a group member's or guest's full name
 * (or the old, full email-derived name for a member) was shown to anyone
 * holding the group code, not just that person. "First name plus last
 * initial" (e.g. "Dana K.") is the shared display-name ceiling for both a
 * member and a guest, everyone but that person's own record.
 */
export function displayName(fullName, emptyFallback = null) {
  if (typeof fullName !== "string" || !fullName.trim()) return emptyFallback;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${parts[0]} ${lastInitial}.`;
}

/** The email's local part's first token, capitalized, with no domain (a member's fallback when there's no name). */
function emailDerivedFirstName(email) {
  if (typeof email !== "string" || !email.includes("@")) return null;
  const token = email.split("@")[0].split(/[._+-]/)[0];
  return token ? token.charAt(0).toUpperCase() + token.slice(1) : null;
}

/**
 * `viewer`: `{ userId, guestId }`, the verified caller's own identity (at
 * most one is set), resolved without ever failing the request. The owner of
 * a record (the caller themself, by user id or by a matching guest session)
 * still sees their own full name; everyone else gets at most "First L." (or,
 * for a member with no name, the email-derived first name - never the full
 * email-derived name).
 */
function safeUser(u, viewer = null) {
  if (!u || typeof u !== "object") return u;
  if (viewer?.userId && u.id === viewer.userId) return { id: u.id, name: u.name ?? null };
  const name = displayName(u.name) ?? emailDerivedFirstName(u.email);
  return { id: u.id, name };
}

/** Same display rule as `safeUser`: "First L.", or "Guest" when there's no name at all. */
function safeGuest(g, viewer = null) {
  if (!g || typeof g !== "object") return g;
  if (viewer?.guestId && g.id === viewer.guestId) return { id: g.id, name: g.name ?? null };
  return { id: g.id, name: displayName(g.name, "Guest") };
}

function publicOrder(o, viewer = null) {
  if (!o || typeof o !== "object") return o;
  const out = { ...o };
  if ("user" in out) out.user = safeUser(out.user, viewer);
  if ("guest" in out) out.guest = safeGuest(out.guest, viewer);
  return out;
}

/** What any holder of the group code may see: no guest session tokens, no member contact details. */
export function publicGroup(g, viewer = null) {
  if (!g) return g;
  const out = { ...g };
  if ("hostUser" in out) out.hostUser = safeUser(out.hostUser, viewer);
  if ("hostGuest" in out) out.hostGuest = safeGuest(out.hostGuest, viewer);
  if (Array.isArray(out.memberUsers)) out.memberUsers = out.memberUsers.map((u) => safeUser(u, viewer));
  if (Array.isArray(out.memberGuests)) out.memberGuests = out.memberGuests.map((gt) => safeGuest(gt, viewer));
  if (Array.isArray(out.orders)) out.orders = out.orders.map((o) => publicOrder(o, viewer));
  return out;
}

const ORDER_INCLUDE = { items: { include: { menuItem: true } }, user: true, guest: true };
const GROUP_INCLUDE = {
  location: true,
  hostUser: true,
  hostGuest: true,
  orders: { include: { items: { include: { menuItem: true } }, user: true, guest: true, seat: true } },
  memberUsers: true,
  memberGuests: true,
};

function sendOrderError(reply, err) {
  if (!(err instanceof OrderError)) {
    if (err && err.refunded !== undefined) {
      console.error("[group-orders] settle failed after a verified charge:", err?.message || err);
      return reply.code(500).send({ error: "PAYMENT_NOT_APPLIED", message: "Payment could not be applied.", refunded: err.refunded });
    }
    throw err;
  }
  if (err.code === "DINE_IN_DISABLED") return reply.code(403).send({ error: DINE_IN_DISABLED_MESSAGE, code: err.code });
  return reply.code(err.status).send({ error: err.code, message: err.message, ...err.extra });
}

/**
 * Creates a GATHERING group hosted by an already-verified member or guest
 * (POST /group-orders and Chappy's start_group_order). Moves no money.
 * Returns { group } or { status, error }.
 */
export async function createGroupOrder(prisma, { hostUserId = null, hostGuestId = null, locationId, estimatedArrival = null, now = new Date() }) {
  if (!locationId || typeof locationId !== "string") return { status: 400, error: "locationId required" };
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) return { status: 404, error: "Location not found" };

  let code = null;
  for (let attempts = 0; !code && attempts < 10; attempts++) {
    const candidate = generateGroupCode();
    if (!(await prisma.groupOrder.findUnique({ where: { code: candidate } }))) code = candidate;
  }
  if (!code) return { status: 500, error: "Failed to generate unique group code" };

  const arrival = estimatedArrival ? new Date(estimatedArrival) : null;
  const group = await prisma.groupOrder.create({
    data: {
      code,
      locationId,
      tenantId: location.tenantId,
      hostUserId,
      hostGuestId,
      estimatedArrival: arrival && !Number.isNaN(arrival.getTime()) ? arrival : null,
      expiresAt: new Date(now.getTime() + GROUP_TTL_MS),
      status: "GATHERING",
    },
  });
  return { group };
}

export async function registerGroupOrderRoutes(app, {
  prisma,
  stripe,
  customerAuth,
  isDineInOrdersEnabled = () => true,
  effects,
  now = () => new Date(),
}) {
  /**
   * `{ userId, guestId }` (at most one set), the verified caller's own
   * identity - never fails. Used only to let a member or guest see their
   * own full name in `safeUser`/`safeGuest` above; an unverified caller
   * never gets more than anyone else. A guest is proven the same way
   * `actor()` below proves one: a server-issued `Guest.sessionToken` sent
   * as `x-guest-session` - never a client-sent guestId.
   */
  async function resolveViewer(req) {
    const who = await customerAuth.resolve(req);
    const userId = orderOwnerId(who);
    if (userId) return { userId, guestId: null };
    const token = req.headers?.[GUEST_SESSION_HEADER];
    if (typeof token === "string" && token) {
      const guest = await prisma.guest.findUnique({ where: { sessionToken: token } });
      if (guest && new Date(guest.expiresAt) > now()) return { userId: null, guestId: guest.id };
    }
    return { userId: null, guestId: null };
  }

  /**
   * Who is acting: { userId, guestId, verified } or { status, error }.
   * A verified member (Clerk) or a verified guest (session token); otherwise
   * a bare body guestId, unverified.
   */
  async function actor(req) {
    const who = await customerAuth.resolve(req);
    const userId = orderOwnerId(who);
    if (userId) return { userId, guestId: null, verified: true };
    if (who?.kind === "user") return { status: 403, error: "No account for this sign-in yet" };
    const token = req.headers?.[GUEST_SESSION_HEADER];
    if (typeof token === "string" && token) {
      const guest = await prisma.guest.findUnique({ where: { sessionToken: token } });
      if (!guest || !(new Date(guest.expiresAt) > now())) return { status: 401, error: "Guest session expired" };
      return { userId: null, guestId: guest.id, verified: true };
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const guestId = typeof body.guestId === "string" && body.guestId ? body.guestId : null;
    if (guestId) return { userId: null, guestId, verified: false };
    return { status: 401, error: "Sign in or continue as a guest" };
  }

  /** A verified caller, else sends 401/403 and returns null. */
  async function verifiedActor(req, reply) {
    const a = await actor(req);
    if (a.status) {
      reply.code(a.status).send({ error: a.error });
      return null;
    }
    if (!a.verified) {
      reply.code(401).send({ error: "Sign in or continue as a guest" });
      return null;
    }
    return a;
  }

  const isHostOf = (group, a) => Boolean(a?.verified && ((a.userId && a.userId === group.hostUserId) || (a.guestId && a.guestId === group.hostGuestId)));

  const findGroup = (code, include) => prisma.groupOrder.findUnique({ where: { code: String(code || "").toUpperCase() }, ...(include ? { include } : {}) });

  /** The group, when the caller is its verified host; else sends 401/403/404 and returns null. */
  async function hostGroup(req, reply) {
    const a = await verifiedActor(req, reply);
    if (!a) return null;
    const group = await findGroup(req.params.code);
    if (!group) {
      reply.code(404).send({ error: "Group not found" });
      return null;
    }
    if (!isHostOf(group, a)) {
      reply.code(403).send({ error: "Only the group's host can do that" });
      return null;
    }
    return { group, actor: a };
  }

  const fullGroup = async (id, viewerId = null) => publicGroup(await prisma.groupOrder.findUnique({ where: { id }, include: GROUP_INCLUDE }), viewerId);

  app.post("/group-orders", async (req, reply) => {
    const a = await verifiedActor(req, reply);
    if (!a) return reply;
    const { locationId, estimatedArrival } = req.body || {};
    const result = await createGroupOrder(prisma, { hostUserId: a.userId, hostGuestId: a.guestId, locationId, estimatedArrival, now: now() });
    if (result.error) return reply.code(result.status).send({ error: result.error });
    return fullGroup(result.group.id, { userId: a.userId, guestId: a.guestId });
  });

  app.get("/group-orders/:code", async (req, reply) => {
    const group = await findGroup(req.params.code, GROUP_INCLUDE);
    if (!group) return reply.code(404).send({ error: "Group not found" });
    if (now() > new Date(group.expiresAt) && group.status === "GATHERING") {
      await prisma.groupOrder.update({ where: { id: group.id }, data: { status: "CANCELLED" } });
      return reply.code(410).send({ error: "Group order has expired" });
    }
    return publicGroup(group, await resolveViewer(req));
  });

  app.post("/group-orders/:code/join", async (req, reply) => {
    const a = await actor(req);
    if (a.status) return reply.code(a.status).send({ error: a.error });
    const group = await findGroup(req.params.code, { orders: true, memberUsers: true, memberGuests: true });
    if (!group) return reply.code(404).send({ error: "Group not found" });
    if (group.status !== "GATHERING") return reply.code(400).send({ error: "Group is no longer accepting new members" });
    if (now() > new Date(group.expiresAt)) return reply.code(410).send({ error: "Group order has expired" });
    if ((group.orders || []).length + 1 >= MAX_GROUP_MEMBERS) return reply.code(400).send({ error: `Group is full (max ${MAX_GROUP_MEMBERS} people)` });

    const ids = (list) => (list || []).map((m) => (typeof m === "object" ? m.id : m));
    const data = {};
    if (a.userId && !ids(group.memberUsers).includes(a.userId)) data.memberUsers = { connect: { id: a.userId } };
    if (!a.userId && a.guestId && !ids(group.memberGuests).includes(a.guestId)) data.memberGuests = { connect: { id: a.guestId } };
    if (Object.keys(data).length) await prisma.groupOrder.update({ where: { id: group.id }, data });
    return fullGroup(group.id, { userId: a.userId, guestId: a.guestId });
  });

  app.patch("/group-orders/:code", async (req, reply) => {
    const found = await hostGroup(req, reply);
    if (!found) return reply;
    const { group } = found;
    const { status, paymentMethod } = req.body || {};
    if (status !== undefined && SERVER_STATUSES.has(status)) {
      return reply.code(400).send({ error: "PAYMENT_STATUS_SERVER_OWNED", message: "Payment status is set by the server after payment." });
    }
    if (status !== undefined && !CLIENT_STATUSES.has(status)) return reply.code(400).send({ error: "Unknown status" });

    const data = {};
    if (status === "CLOSED" && group.status === "GATHERING") {
      data.status = "CLOSED";
      data.closedAt = now();
    }
    if (status === "CANCELLED") {
      const paid = await prisma.order.count({ where: { groupOrderId: group.id, paymentStatus: "PAID" } });
      if (paid > 0 || group.status === "PAID") return reply.code(409).send({ error: "GROUP_HAS_PAID_ORDERS", message: "A group with paid orders can't be cancelled." });
      data.status = "CANCELLED";
      // Best effort: the host's open group PaymentIntent must not stay payable.
      // If it already succeeded the cancel fails; markGroupPaid then refuses
      // the cancelled group and refunds that charge in full.
      if (group.paymentIntentId && stripe?.paymentIntents?.cancel) {
        await stripe.paymentIntents.cancel(group.paymentIntentId).catch((err) => console.error(`[group-orders] could not cancel ${group.paymentIntentId}:`, err?.message || err));
      }
    }
    if (paymentMethod !== undefined) {
      if (!["HOST_PAYS_ALL", "PAY_YOUR_OWN"].includes(paymentMethod)) return reply.code(400).send({ error: "Unknown paymentMethod" });
      if (group.status === "PAYING" || group.status === "PAID") return reply.code(409).send({ error: "GROUP_PAYING", message: "Payment has already started." });
      data.paymentMethod = paymentMethod;
    }
    if (Object.keys(data).length) await prisma.groupOrder.update({ where: { id: group.id }, data });
    return fullGroup(group.id, { userId: found.actor.userId, guestId: found.actor.guestId });
  });

  app.post("/group-orders/:code/orders", async (req, reply) => {
    if (!isDineInOrdersEnabled()) return reply.code(403).send({ error: DINE_IN_DISABLED_MESSAGE, code: "DINE_IN_DISABLED" });
    const body = req.body || {};
    if (!Array.isArray(body.items) || body.items.length === 0) return reply.code(400).send({ error: "items required" });
    const a = await actor(req);
    if (a.status) return reply.code(a.status).send({ error: a.error });

    const group = await findGroup(req.params.code);
    if (!group) return reply.code(404).send({ error: "Group not found" });
    if (group.status !== "GATHERING" && group.status !== "CLOSED") return reply.code(409).send({ error: "GROUP_NOT_OPEN", message: "Cannot add orders to this group" });

    try {
      const t = now();
      const quote = await quoteOrder(prisma, { locationId: group.locationId, items: body.items, userId: a.userId, now: t });
      const arrival = group.estimatedArrival && new Date(group.estimatedArrival) > t ? group.estimatedArrival : null;
      const order = await createOrder(prisma, {
        quote,
        locationId: group.locationId,
        tenantId: group.tenantId,
        userId: a.userId,
        guestId: a.guestId,
        estimatedArrival: arrival,
        group: { groupOrderId: group.id, isGroupHost: isHostOf(group, a) },
        source: "WEB",
        now: t,
        isDineInOrdersEnabled,
      });
      return publicOrder(await prisma.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE }), { userId: a.userId, guestId: a.guestId });
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.delete("/group-orders/:code/orders/:orderId", async (req, reply) => {
    const a = await verifiedActor(req, reply);
    if (!a) return reply;
    const group = await findGroup(req.params.code);
    if (!group) return reply.code(404).send({ error: "Group not found" });
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    if (order.groupOrderId !== group.id) return reply.code(400).send({ error: "Order does not belong to this group" });
    const own = (a.userId && order.userId === a.userId) || (a.guestId && order.guestId === a.guestId && !order.userId);
    if (!own && !isHostOf(group, a)) return reply.code(403).send({ error: "Forbidden" });
    if (order.paymentStatus === "PAID") return reply.code(400).send({ error: "Cannot delete paid orders" });
    if (group.status === "PAYING") return reply.code(409).send({ error: "GROUP_PAYING", message: "The host is paying for this group." });

    // Give back a pod this unpaid order held, then remove it.
    if (order.seatId) {
      const seats = [order.seatId, ...(order.isDualPod && order.dualPartnerSeatId ? [order.dualPartnerSeatId] : [])];
      await prisma.seat.updateMany({ where: { id: { in: seats }, status: "RESERVED" }, data: { status: "AVAILABLE" } });
    }
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    return { success: true };
  });

  app.post("/group-orders/:code/transfer-host", async (req, reply) => {
    const found = await hostGroup(req, reply);
    if (!found) return reply;
    const { group } = found;
    // The host is paying: the payer must not change under a live PaymentIntent.
    if (group.status === "PAYING") return reply.code(409).send({ error: "GROUP_PAYING", message: "The host is paying for this group." });
    const { newHostUserId, newHostGuestId } = req.body || {};
    if (!newHostUserId && !newHostGuestId) return reply.code(400).send({ error: "Either newHostUserId or newHostGuestId required" });
    const orders = await prisma.order.findMany({ where: { groupOrderId: group.id } });
    const target = orders.find((o) => (newHostUserId && o.userId === newHostUserId) || (newHostGuestId && !o.userId && o.guestId === newHostGuestId));
    if (!target) return reply.code(400).send({ error: "New host must have an order in the group" });

    await prisma.groupOrder.update({ where: { id: group.id }, data: { hostUserId: target.userId || null, hostGuestId: target.userId ? null : target.guestId || null } });
    await prisma.order.updateMany({ where: { groupOrderId: group.id }, data: { isGroupHost: false } });
    await prisma.order.update({ where: { id: target.id }, data: { isGroupHost: true } });
    return fullGroup(group.id, { userId: found.actor.userId, guestId: found.actor.guestId });
  });

  app.post("/group-orders/:code/complete", async (req, reply) => {
    const found = await hostGroup(req, reply);
    if (!found) return reply;
    const { group } = found;
    const { seatIds, seatingOption } = req.body || {};
    const orders = (await prisma.order.findMany({ where: { groupOrderId: group.id } })).filter((o) => o.status !== "CANCELLED");
    if (orders.length === 0) return reply.code(400).send({ error: "No orders in this group" });

    if (group.status === "PAID" && orders.every((o) => o.status === "QUEUED" && o.podSelectionMethod === "GROUP_HOST_SELECTED")) {
      return fullGroup(group.id, { userId: found.actor.userId, guestId: found.actor.guestId });
    }
    if (!orders.every((o) => o.paymentStatus === "PAID")) return reply.code(400).send({ error: "Not all orders are paid" });

    const t = now();
    await prisma.groupOrder.updateMany({ where: { id: group.id, status: { not: "PAID" } }, data: { status: "PAID", finalizedAt: t } });
    const wanted = Array.isArray(seatIds) ? seatIds.filter((s) => typeof s === "string" && s) : [];
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const data = { queuedAt: order.queuedAt || t, paidAt: order.paidAt || t };
      if (order.status === "PENDING_PAYMENT" || order.status === "PAID") data.status = "QUEUED";
      const seatId = wanted[i];
      if (seatId && !order.seatId) {
        // Race-safe: only a free pod at this location is taken.
        const claim = await prisma.seat.updateMany({
          where: { id: seatId, locationId: group.locationId, status: "AVAILABLE", retiredAt: null },
          data: { status: "RESERVED", reservedUntil: new Date(t.getTime() + 30 * 60 * 1000) },
        });
        if (claim.count === 1) {
          data.seatId = seatId;
          data.podSelectionMethod = "GROUP_HOST_SELECTED";
        }
      }
      await prisma.order.update({ where: { id: order.id }, data });
    }
    console.log(`[Group Order Completed] Code: ${group.code}, Orders: ${orders.length}, Seating Option: ${seatingOption}`);
    return fullGroup(group.id, { userId: found.actor.userId, guestId: found.actor.guestId });
  });

  app.post("/group-orders/:code/payment-intent", async (req, reply) => {
    const who = await customerAuth.requireUser(req, reply);
    if (!who) return reply;
    const group = await findGroup(req.params.code);
    if (!group) return reply.code(404).send({ error: "Group not found" });
    if (!group.hostUserId || group.hostUserId !== who.userId) return reply.code(403).send({ error: "Only the group's host can pay for the group" });
    try {
      // Reuses, settles or replaces the group's stored PaymentIntent; never makes a second live one.
      return await createGroupPaymentIntent(prisma, stripe, { groupOrderId: group.id, now: now() }, effects);
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });

  app.post("/group-orders/:code/confirm-payment", async (req, reply) => {
    const group = await findGroup(req.params.code);
    if (!group) return reply.code(404).send({ error: "Group not found" });
    const { paymentIntentId = null } = req.body || {};
    // With a PaymentIntent this is safe for any caller, like
    // /orders/:id/confirm-payment: nothing is paid unless Stripe says this
    // group's own PaymentIntent took exactly the sum of the orders it lists.
    // That lets the Stripe webhook (and the host's revisit) recover a charge
    // whose confirmation never arrived. A zero-balance confirm (no
    // PaymentIntent) spends only savings, so it needs the signed-in host.
    if (!paymentIntentId && !(customerAuth.isServiceCall && customerAuth.isServiceCall(req))) {
      const who = await customerAuth.requireUser(req, reply);
      if (!who) return reply;
      if (!group.hostUserId || group.hostUserId !== who.userId) return reply.code(403).send({ error: "Only the group's host can pay for the group" });
    }
    try {
      const result = await markGroupPaid(prisma, stripe, { groupOrderId: group.id, paymentIntentId, now: now() }, effects);
      const viewer = await resolveViewer(req);
      return { alreadyPaid: result.alreadyPaid, orders: (result.orders || []).map((o) => publicOrder(o, viewer)), group: await fullGroup(group.id, viewer) };
    } catch (err) {
      return sendOrderError(reply, err);
    }
  });
}
