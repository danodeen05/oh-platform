/**
 * English SMS copy (Task F2, fix round 1: tierUp got its missing article -
 * "a Noodle Master", not "Noodle Master"). Every key here must also exist,
 * with the same name, in every other locale file (see
 * notifications/__tests__/templates.test.js). Each value is
 * `(vars) => string`. No emoji, no em dashes (U+2014).
 */

// Program tier display names (packages/api/src/membership/program.js PROGRAM.tiers
// keys), matching apps/web/messages/en.json's member.tiers wording exactly.
const TIER_NAMES = {
  CHOPSTICK: "Chopstick",
  NOODLE_MASTER: "Noodle Master",
  BEEF_BOSS: "Beef Boss",
};

export default {
  orderConfirmed: ({ orderNumber, total, link }) =>
    `Oh! Order #${orderNumber} confirmed, ${total}. Follow it live: ${link}`,
  orderConfirmedNoLink: ({ orderNumber, total }) =>
    `Oh! Order #${orderNumber} confirmed. Total: ${total}. Show this text at check-in.`,

  podReady: ({ podNumber, link }) => `Oh! Pod #${podNumber} is ready. Live status: ${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! Your Pod #${podNumber} is ready. Order #${orderNumber}. Head to your pod to enjoy your meal.`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! Order #${orderNumber}: You're #${position} in line. Estimated wait: ~${minutes} min. We'll notify you when your pod is ready!`,

  orderReady: ({ orderNumber }) => `Oh! Your order #${orderNumber} is ready! Head over to pick it up. Enjoy!`,

  tierUp: ({ tierKey, link }) =>
    `Oh! You're now a ${TIER_NAMES[tierKey] || tierKey}. Your free bowl is waiting: ${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! ${amount} in credit expires ${date}. Use it before it's gone: ${link}`,
};
