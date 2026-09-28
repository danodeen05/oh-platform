/**
 * POST /meal-gifts/:id/pay-forward (Task D5 fix round 2, moved from index.js).
 *
 * "Pay it forward": a guest offered a meal gift passes it on; the gift stays
 * PENDING for the next person and the pass is recorded in its chain. It used
 * to take any body `recipientId` with no auth, so anyone could record a pass
 * as any member (whose name then showed in the public gift views). Now the
 * caller must be a signed-in member and IS the recipient; a body
 * `recipientId` naming someone else is a 403. Nothing moves money here.
 */
import { publicMealGift } from "./meal-gift-view.js";

export const MAX_PAY_FORWARD_MESSAGE = 280;

export function registerMealGiftPayForward(app, { prisma, customerAuth, now = () => new Date() }) {
  app.post("/meal-gifts/:id/pay-forward", async (req, reply) => {
    const { id } = req.params;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const who = await customerAuth.requireUser(req, reply);
    if (!who) return reply;
    if (!who.userId) return reply.code(403).send({ error: "Finish creating your account first." });
    if (body.recipientId !== undefined && body.recipientId !== who.userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const messageFromRecipient =
      typeof body.messageFromRecipient === "string" ? body.messageFromRecipient.trim().slice(0, MAX_PAY_FORWARD_MESSAGE) || null : null;

    const mealGift = await prisma.mealGift.findUnique({ where: { id } });
    if (!mealGift) return reply.code(404).send({ error: "Meal gift not found" });
    if (mealGift.status !== "PENDING") return reply.code(400).send({ error: "Meal gift is not available" });
    if (now() > mealGift.expiresAt) return reply.code(400).send({ error: "Meal gift has expired" });

    const updatedGift = await prisma.mealGift.update({ where: { id }, data: { payForwardCount: { increment: 1 } } });
    await prisma.mealGiftChain.create({
      data: { mealGiftId: id, recipientId: who.userId, action: "PAID_FORWARD", messageFromRecipient },
    });
    return publicMealGift(updatedGift);
  });
}

/**
 * When a new meal gift lapses (Task D9): 9pm on the location's own clock
 * that day, or 9pm the next day when it's already past 9pm there. The old
 * code used the server's clock (`setHours(21)`), which on a UTC host is
 * 3pm in Denver in summer, so a gift given in the afternoon lapsed hours
 * before closing.
 */
export function mealGiftExpiresAt(now = new Date(), timeZone = "America/Denver", hour = 21) {
  const tz = timeZone || "America/Denver";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = (d) => {
    const o = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, s: +o.second };
  };
  // Local wall time minus UTC (ms) for `tz` at instant `d`.
  const offset = (d) => {
    const p = parts(d);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
  };
  const local = parts(now);
  const wall = Date.UTC(local.y, local.m - 1, local.d + (local.h >= hour ? 1 : 0), hour, 0, 0);
  let at = wall - offset(new Date(wall));
  at = wall - offset(new Date(at)); // settle across a DST change
  return new Date(at);
}
