/**
 * Locale support shared by notifications (notifications.js: which template a
 * text picks) and the customer-facing PATCH /users/:id route (index.js:
 * saving a signed-in member's preferred locale).
 */

/** The only 4 locales the site ships copy for. */
export const SUPPORTED_LOCALES = Object.freeze(["en", "zh-TW", "zh-CN", "es"]);

const LOCALE_ALIASES = { en: "en", "zh-tw": "zh-TW", "zh-cn": "zh-CN", es: "es" };

/** Normalizes any locale-ish input (e.g. "zh-tw") to one of SUPPORTED_LOCALES, defaulting to "en". */
export function normalizeLocale(input) {
  const key = typeof input === "string" ? input.trim().toLowerCase() : "";
  return LOCALE_ALIASES[key] || "en";
}

/**
 * A notification's locale: `user.locale`, then `order.locale` (only some
 * order-shaped objects carry one; most don't - the column doesn't exist on
 * the Order model today), then `guest.locale` (same caveat), then "en".
 * Always normalized to one of the 4 supported locales.
 */
export function resolveLocale(user, order, guest) {
  return normalizeLocale(user?.locale ?? order?.locale ?? guest?.locale ?? "en");
}

/**
 * PATCH /users/:id (self-update; locale is the only field today). Identity
 * (the caller must be this user, or a trusted service call) is enforced by
 * auth/customer.js's `registerCustomerIdentity` onRoute hook before the route
 * handler ever runs - this only validates the body and writes. Returns
 * `{ status, body }` for the route to send directly, so it's unit-testable
 * without a live Fastify app.
 */
export async function applyUserLocaleUpdate(prisma, { id, locale }) {
  if (locale === undefined) {
    return { status: 400, body: { error: "No fields to update" } };
  }
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return { status: 400, body: { error: "Unsupported locale", code: "INVALID_LOCALE" } };
  }
  // Task F2 fix round 1 (review minor): return only what changed, not the
  // whole User row (PATCH /users/:id/phone does the same today, but that's
  // not a reason to add a second over-broad response).
  const user = await prisma.user.update({ where: { id }, data: { locale }, select: { id: true, locale: true } });
  return { status: 200, body: user };
}
