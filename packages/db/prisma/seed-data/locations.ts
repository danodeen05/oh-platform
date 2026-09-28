/**
 * Location i18n for the two real dine-in locations (Task A8's comb-seat
 * slugs: "city-creek" / "university-place"). Keyed by `Location.slug`, used
 * by both packages/db/prisma/seed-prod.ts and
 * packages/db/scripts/backfill-i18n.ts.
 *
 * `address` is kept in its original English/US Postal form in every locale
 * (that's what delivery drivers, GPS and mail actually need); `name` gets a
 * natural local-language name with the English original kept in
 * parentheses, and `landmarks` is a short, accurate local reference point.
 */

export interface LocationCopy {
  name: string;
  address: string;
  landmarks?: string;
}

export interface LocationI18nEntry {
  en: LocationCopy;
  "zh-TW": LocationCopy;
  "zh-CN": LocationCopy;
  es: LocationCopy;
}

export const LOCATION_I18N: Record<string, LocationI18nEntry> = {
  "city-creek": {
    en: {
      name: "City Creek Mall",
      address: "50 S Main St, Salt Lake City, UT 84101",
      landmarks: "Near Temple Square",
    },
    "zh-TW": {
      name: "城溪購物中心（City Creek Mall）",
      address: "50 S Main St, Salt Lake City, UT 84101",
      // Fix round 1 (review, Important 6): 天普廣場 was an ad hoc
      // transliteration. The Church's own Chinese name for Temple Square
      // is 聖殿廣場 / 圣殿广场.
      landmarks: "鄰近聖殿廣場",
    },
    "zh-CN": {
      name: "城溪购物中心（City Creek Mall）",
      address: "50 S Main St, Salt Lake City, UT 84101",
      landmarks: "邻近圣殿广场",
    },
    es: {
      name: "City Creek Mall",
      address: "50 S Main St, Salt Lake City, UT 84101",
      landmarks: "Cerca de Temple Square",
    },
  },
  "university-place": {
    en: {
      name: "University Place",
      address: "575 E University Pkwy, Orem, UT 84097",
      landmarks: "Near Utah Valley University",
    },
    "zh-TW": {
      name: "大學廣場（University Place）",
      address: "575 E University Pkwy, Orem, UT 84097",
      landmarks: "鄰近猶他谷大學",
    },
    "zh-CN": {
      name: "大学广场（University Place）",
      address: "575 E University Pkwy, Orem, UT 84097",
      landmarks: "邻近犹他谷大学",
    },
    es: {
      name: "University Place",
      address: "575 E University Pkwy, Orem, UT 84097",
      landmarks: "Cerca de Utah Valley University",
    },
  },
};
