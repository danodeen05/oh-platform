/**
 * Data for the admin POST /challenges create (Task D10a, parked from F1a).
 * There is no emoji default any more: icons are in-house SVG keys (iconKey),
 * and iconEmoji stays empty unless an admin sets one explicitly.
 * Returns null when a required field is missing.
 */
export function challengeCreateData(body = {}) {
  const { slug, name, description, rewardCents, iconEmoji, iconKey, requirements, startsAt, endsAt } = body || {};
  if (!slug || !name || !description || !requirements) return null;
  return {
    slug,
    name,
    description,
    rewardCents: rewardCents || 0,
    iconEmoji: typeof iconEmoji === "string" ? iconEmoji : "",
    iconKey: typeof iconKey === "string" && iconKey ? iconKey : null,
    requirements,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    isActive: true,
  };
}
