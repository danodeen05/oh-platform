// Task F1a: read-path localizers for database content (badges, challenges,
// locations and menu-item slider labels). Pure functions, no DB, no
// Fastify -- safe to unit test directly and to import from
// packages/api/src/index.js.
//
// Every localizer takes the row as Prisma returns it plus a `locale`
// (already resolved by index.js's `getLocale(req)`, which reads `?locale=`
// then falls back to "en") and returns a shallow copy with `name`/
// `description`/etc. overridden from the row's `i18n` JSON column for a
// non-English locale, falling back to English when the locale or the
// column itself is missing (older rows that predate this task, or a locale
// we don't recognize).
//
// Fix round 1 (review): the row's own columns (name/description/address)
// are the single source of English, always -- for `locale === "en"` AND as
// the fallback for a missing translation. `i18n.en` is never read by any
// API path; it is documentation only (what the seed's English looked like
// when the translations were written), kept so the JSON blob is
// self-describing. Reading it instead of the column would make an admin
// edit to the row's own English text invisible everywhere.

const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN", "es"];

/** Returns the row's own i18n[locale] override, or null for "en" or a
 * locale/column that isn't there -- callers always fall back to the row's
 * own columns, never to i18n.en. */
function pickCopy(i18n, locale) {
  if (!i18n || locale === "en") return null;
  return i18n[locale] || null;
}

/** Badge.i18n -> { name, description } for a non-en locale; en (and any
 * fallback) comes from the row's own columns. Keeps every other field. */
export function localizeBadge(badge, locale = "en") {
  if (!badge) return badge;
  const copy = pickCopy(badge.i18n, locale);
  return {
    ...badge,
    name: copy?.name ?? badge.name,
    description: copy?.description ?? badge.description,
    iconKey: badge.iconKey ?? null,
  };
}

/** Challenge.i18n -> { name, description }, same rule as localizeBadge. */
export function localizeChallenge(challenge, locale = "en") {
  if (!challenge) return challenge;
  const copy = pickCopy(challenge.i18n, locale);
  return {
    ...challenge,
    name: copy?.name ?? challenge.name,
    description: copy?.description ?? challenge.description,
    iconKey: challenge.iconKey ?? null,
  };
}

/** Location.i18n -> { name, address, landmarks }, same rule as localizeBadge. */
export function localizeLocation(location, locale = "en") {
  if (!location) return location;
  const copy = pickCopy(location.i18n, locale);
  return {
    ...location,
    name: copy?.name ?? location.name,
    address: copy?.address ?? location.address,
    landmarks: copy?.landmarks ?? location.landmarks ?? null,
  };
}

/**
 * Adds `sliderConfig.displayLabels` (the localized array for the picker UI)
 * without ever touching `sliderConfig.labels`.
 *
 * Fix round 1 (review, Critical 1): `labels` is the canonical English
 * value the web builder stores as an order's `selectedValue` -- it is
 * queried by slug (Heat Seeker), localized again on order summaries and
 * kitchen tickets, and looked up as a translation key
 * (`t("builder.sliderLabels.${label}")`). Overwriting it with translated
 * text broke all of that. `displayLabels` is a new, additive field; the
 * front ends switch to it in their own D tasks.
 */
function localizeSliderConfig(sliderConfig, locale) {
  if (!sliderConfig) return sliderConfig;
  const labelsI18n = sliderConfig.labelsI18n;
  const displayLabels = (labelsI18n && (labelsI18n[locale] || labelsI18n.en)) || sliderConfig.labels;
  return { ...sliderConfig, displayLabels };
}

/**
 * MenuItem localizer. Behavior for name/description is unchanged from the
 * pre-existing inline version in index.js (nameZhTW/nameZhCN/nameEs
 * columns, not the i18n JSON column -- MenuItem never got one); this adds
 * `sliderConfig.displayLabels` on top, leaving `sliderConfig.labels`
 * untouched (see localizeSliderConfig).
 */
export function localizeMenuItem(item, locale = "en") {
  if (!item) return item;

  const localizedItem = { ...item };

  // Always preserve the original English name for image lookups.
  localizedItem.nameEn = item.name;

  switch (locale) {
    case "zh-TW":
      localizedItem.name = item.nameZhTW || item.name;
      localizedItem.description = item.descriptionZhTW || item.description;
      break;
    case "zh-CN":
      localizedItem.name = item.nameZhCN || item.name;
      localizedItem.description = item.descriptionZhCN || item.description;
      break;
    case "es":
      localizedItem.name = item.nameEs || item.name;
      localizedItem.description = item.descriptionEs || item.description;
      break;
    // English is default, use original name
  }

  if (item.sliderConfig) {
    localizedItem.sliderConfig = localizeSliderConfig(item.sliderConfig, locale);
  }

  return localizedItem;
}

export { SUPPORTED_LOCALES };
