/**
 * GET /users/:id/profile. Extracted from index.js so it can be tested with
 * app.inject; the index.js helpers it needs are passed in as `deps`.
 *
 * Privacy: `referrals` lists the members this user referred. Those are other
 * people, so the response never carries their email, phone or full name; each
 * entry gets a derived `displayName` (first name + last initial, or a generic
 * label) instead. The select below never reads the contact fields at all.
 */

export const REFERRAL_SELECT = { id: true, name: true, createdAt: true, lifetimeOrderCount: true };

/**
 * "Dana Smith" -> "Dana S."; a single token (no spaces, common for Chinese names)
 * is never returned in full, only its first character: "王小明" -> "王."; no name -> "A friend".
 */
export function referralDisplayName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A friend";
  if (parts.length === 1) return `${Array.from(parts[0])[0]}.`;
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.`;
}

/** Whitelist of what a referred member's row may expose to the referrer. */
export function publicReferral(r) {
  return { id: r.id, displayName: referralDisplayName(r.name), createdAt: r.createdAt, lifetimeOrderCount: r.lifetimeOrderCount };
}

export function registerProfileRoute(app, { prisma, profileForUser, getLocale, localizeBadge, localizeChallenge, isTrackableChallenge, legacyTierBenefits, legacyNextTier, legacyTierProgress }) {
  app.get("/users/:id/profile", async (req, reply) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        badges: {
          include: {
            badge: true,
          },
          orderBy: {
            earnedAt: "desc",
          },
        },
        challenges: {
          include: {
            challenge: true,
          },
          where: {
            completedAt: null, // Only active challenges
          },
        },
        referrals: {
          select: REFERRAL_SELECT,
        },
      },
    });

    if (!user) return reply.code(404).send({ error: "User not found" });
    user.referrals = (user.referrals || []).map(publicReferral);


    // Tier, progress, credits, expiring lots, rewards and badges all come from
    // the membership engine now (packages/api/src/membership/engine.js).
    // tierBenefits/nextTier/tierProgress below are a back-compat shim mapping
    // the engine's shape onto the old response keys so the pre-Phase-D UI
    // keeps working; the new UI should read `membership` directly.
    const membership = await profileForUser(prisma, id, new Date());
    const locale = getLocale(req);
    user.badges = user.badges.map((ub) => ({ ...ub, badge: localizeBadge(ub.badge, locale) }));
    // Task D9 fix round 1: only challenges the engine can complete (membership/challenge-rules.js).
    user.challenges = user.challenges.filter((uc) => isTrackableChallenge(uc.challenge)).map((uc) => ({ ...uc, challenge: localizeChallenge(uc.challenge, locale) }));
    // Fix round 1 (review, Important 2): the new UI reads `membership.badges`
    // directly (see the comment above), so it needs localizing too, not just
    // the back-compat `user.badges` shim.
    if (membership) {
      membership.badges = membership.badges.map((ub) => ({ ...ub, badge: localizeBadge(ub.badge, locale) }));
    }

    return {
      ...user,
      tierBenefits: legacyTierBenefits(membership.tier),
      nextTier: legacyNextTier(membership.tier),
      tierProgress: legacyTierProgress(membership.progress),
      membership,
    };
  });
}
