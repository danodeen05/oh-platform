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
