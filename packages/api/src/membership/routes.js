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
 *   POST /users/:id/moments    Task D8: the member passport's one-time
 *                              moments. {welcomeSeen?: true,
 *                              tierCelebrated?: <program tier key>} sets
 *                              welcomeSeenAt (first time only) and
 *                              lastTierCelebrated. Same requireSelf guard.
 *                              Idempotent: repeating a call changes nothing.
 */
import { PROGRAM, publicProgram } from "./program.js";

const MOMENT_KEYS = new Set(["welcomeSeen", "tierCelebrated"]);

/** The validated update for a moments body, or an error string. */
export function parseMoments(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Body must be an object" };
  const keys = Object.keys(body);
  if (keys.length === 0) return { error: "Nothing to record" };
  const unknown = keys.filter((k) => !MOMENT_KEYS.has(k));
  if (unknown.length) return { error: `Unknown fields: ${unknown.join(", ")}` };
  const out = {};
  if ("welcomeSeen" in body) {
    if (body.welcomeSeen !== true) return { error: "welcomeSeen must be true" };
    out.welcomeSeen = true;
  }
  if ("tierCelebrated" in body) {
    const tier = body.tierCelebrated;
    if (typeof tier !== "string" || !PROGRAM.tiers.some((t) => t.key === tier)) {
      return { error: "tierCelebrated must be a program tier" };
    }
    out.tierCelebrated = tier;
  }
  return { value: out };
}

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

  app.post("/users/:id/moments", async (req, reply) => {
    const { id } = req.params;
    const parsed = parseMoments(req.body);
    if (parsed.error) return reply.code(400).send({ error: parsed.error });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    let changed = false;
    // First sighting wins: a repeat (another tab, a retry) keeps the original
    // time. The write is conditional on the column still being null, so two
    // racing first calls can't both stamp it.
    if (parsed.value.welcomeSeen && !user.welcomeSeenAt) {
      await prisma.user.updateMany({ where: { id, welcomeSeenAt: null }, data: { welcomeSeenAt: new Date() } });
      changed = true;
    }
    if (parsed.value.tierCelebrated && user.lastTierCelebrated !== parsed.value.tierCelebrated) {
      await prisma.user.update({ where: { id }, data: { lastTierCelebrated: parsed.value.tierCelebrated } });
      changed = true;
    }
    const row = changed ? await prisma.user.findUnique({ where: { id } }) : user;
    return {
      welcomeSeenAt: row.welcomeSeenAt ? new Date(row.welcomeSeenAt).toISOString() : null,
      lastTierCelebrated: row.lastTierCelebrated || null,
    };
  });
}
