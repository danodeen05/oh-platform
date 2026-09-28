// Task F1a: read-path localizers for database content (badges, challenges,
// locations and menu-item slider labels). Pure functions, no DB, no
// Fastify -- safe to unit test directly and to import from
// packages/api/src/index.js.
//
// Every localizer takes the row as Prisma returns it plus a `locale`
// (already resolved by index.js's `getLocale(req)`, which reads `?locale=`
// then falls back to "en") and returns a shallow copy with `name`/
// `description`/etc. overridden from the row's `i18n` JSON column, falling
// back to English when the locale or the column itself is missing (older
// rows that predate this task, or a locale we don't recognize).

const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN", "es"];

function pickCopy(i18n, locale) {
  if (!i18n) return null;
  return i18n[locale] || i18n.en || null;
}

/** Badge.i18n -> { name, description }, keeping every other field as-is. */
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

/** Challenge.i18n -> { name, description }, keeping every other field as-is. */
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

/** Location.i18n -> { name, address, landmarks }, keeping every other field as-is. */
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

/** MenuItem.sliderConfig.labelsI18n -> sliderConfig.labels, preserving min/max/step/default. */
function localizeSliderConfig(sliderConfig, locale) {
  if (!sliderConfig || !sliderConfig.labelsI18n) return sliderConfig;
  const labels = sliderConfig.labelsI18n[locale] || sliderConfig.labelsI18n.en || sliderConfig.labels;
  return { ...sliderConfig, labels };
}

/**
 * MenuItem localizer. Behavior for name/description is unchanged from the
 * pre-existing inline version in index.js (nameZhTW/nameZhCN/nameEs columns,
 * not the i18n JSON column -- MenuItem never got one); this adds slider
 * label localization on top.
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
