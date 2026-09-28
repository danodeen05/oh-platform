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
