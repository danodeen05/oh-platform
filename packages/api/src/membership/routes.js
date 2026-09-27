/**
 * Membership routes.
 *
 *   GET /membership/program    Public: the tier/cashback/referral config the
 *                              customer site renders (no PII, no goodwill config).
 *   GET /users/:id/rewards     The caller's own active and past rewards.
 *                              Guarded by requireSelf via the onRoute hook
 *                              registerCustomerIdentity installs for every
 *                              /users/:id/* route (see auth/customer.js) -
 *                              this file adds no auth of its own.
 */
import { publicProgram } from "./program.js";

export async function registerMembershipRoutes(app, { prisma }) {
  app.get("/membership/program", async () => publicProgram());

  app.get("/users/:id/rewards", async (req, reply) => {
    const { id } = req.params;
    const now = new Date();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const rewards = await prisma.reward.findMany({ where: { userId: id } });
    return {
      rewards: rewards.map((r) => ({
        ...r,
        active: !r.redeemedAt && r.windowEndsAt > now,
      })),
    };
  });
}
