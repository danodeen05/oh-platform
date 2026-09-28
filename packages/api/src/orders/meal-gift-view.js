/**
 * What anonymous callers see of a meal gift (Task D5 fix round 2).
 *
 * GET /meal-gifts/next/:locationId and GET /meal-gifts/:id are public (the
 * order flow shows the next gift before any purchase). They used to return
 * the giver's and every chain recipient's FULL name and user id, and the
 * gift's order id and number. Now: names are "First L." (the A8b group
 * display rule, group-routes.js `displayName`), and user ids, emails and the
 * order are dropped. The amount, message, status and dates stay.
 */
import { displayName } from "./group-routes.js";

function person(p) {
  if (!p || typeof p !== "object") return null;
  return { name: displayName(p.name) };
}

export function publicMealGift(gift) {
  if (!gift || typeof gift !== "object") return gift;
  const { giverId: _g, acceptedById: _a, orderId: _o, order: _order, stripePaymentIntentId: _pi, giver, acceptedBy, chain, ...rest } = gift;
  const out = { ...rest };
  if (giver !== undefined) out.giver = person(giver);
  if (acceptedBy !== undefined) out.acceptedBy = person(acceptedBy);
  if (Array.isArray(chain)) {
    out.chain = chain.map(({ recipientId: _r, recipient, ...c }) => ({ ...c, recipient: person(recipient) }));
  }
  return out;
}

/**
 * The FIFO gift GET /meal-gifts/next/:locationId offers: the oldest pending,
 * funded, unexpired gift at the location - Task D5 fix round 3 (follow-up):
 * excluding one `excludeGiverId` gave themselves, so a verified caller is
 * never offered their own gift back (resolveMealGift in orders/service.js
 * already refuses to let a giver redeem their own gift; this keeps the
 * suggestion from pointing at it in the first place). `excludeGiverId` is
 * null for an anonymous/unverified caller, who still sees the plain FIFO
 * gift - there is no identity to exclude.
 */
export async function nextMealGiftFor(prisma, { locationId, excludeGiverId = null, now = new Date() }) {
  return prisma.mealGift.findFirst({
    where: {
      locationId,
      status: "PENDING",
      paidAt: { not: null },
      expiresAt: { gt: now },
      ...(excludeGiverId ? { giverId: { not: excludeGiverId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      giver: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, city: true } },
      chain: {
        include: { recipient: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
