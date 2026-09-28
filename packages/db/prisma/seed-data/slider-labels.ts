/**
 * `labelsI18n` for every slider MenuItem in packages/db/prisma/seed-prod.ts
 * (the broth richness, noodle texture, spice level and topping-amount
 * sliders, ~lines 180-187). Keyed by the MenuItem's `category`
 * ("slider01".."slider08"), used by both seed-prod.ts and
 * packages/db/scripts/backfill-i18n.ts.
 *
 * Each slider gets its own explicit word list rather than one shared
 * dictionary: the same English word means different things in different
 * sliders (e.g. "Light" is flavor intensity on the soup-richness slider but
 * a small *amount* on the topping sliders), and translating them the same
 * way would be wrong in one context or the other.
 */

export interface SliderLabelsI18n {
  en: string[];
  "zh-TW": string[];
  "zh-CN": string[];
  es: string[];
}

function build(rows: { en: string; "zh-TW": string; "zh-CN": string; es: string }[]): SliderLabelsI18n {
  return {
    en: rows.map((r) => r.en),
    "zh-TW": rows.map((r) => r["zh-TW"]),
    "zh-CN": rows.map((r) => r["zh-CN"]),
    es: rows.map((r) => r.es),
  };
}

// Topping *amount* (bok choy, green onions, cilantro, sprouts, pickled
// greens all share this exact 4-step scale: none / a little / normal /
// extra). Shared with the API's `sliderValueTranslations` "None"/"Normal"/
// "Extra" entries, but "Light" here is deliberately not the same word as
// the soup-richness slider's "Light" (flavor), since this is a quantity.
const TOPPING_AMOUNT = build([
  { en: "None", "zh-TW": "不加", "zh-CN": "不加", es: "Sin" },
  { en: "Light", "zh-TW": "少量", "zh-CN": "少量", es: "Poco" },
  { en: "Normal", "zh-TW": "正常", "zh-CN": "正常", es: "Normal" },
  { en: "Extra", "zh-TW": "加量", "zh-CN": "加量", es: "Extra" },
]);

export const SLIDER_LABELS_I18N: Record<string, SliderLabelsI18n> = {
  // Soup Richness: flavor intensity, not quantity.
  slider01: build([
    { en: "Light", "zh-TW": "清淡", "zh-CN": "清淡", es: "Ligero" },
    { en: "Medium", "zh-TW": "中等", "zh-CN": "中等", es: "Medio" },
    { en: "Rich", "zh-TW": "濃郁", "zh-CN": "浓郁", es: "Intenso" },
    { en: "Extra Rich", "zh-TW": "特濃", "zh-CN": "特浓", es: "Extra Intenso" },
  ]),
  // Noodle Texture.
  slider02: build([
    { en: "Firm", "zh-TW": "偏硬", "zh-CN": "偏硬", es: "Firme" },
    { en: "Medium", "zh-TW": "中等", "zh-CN": "中等", es: "Medio" },
    { en: "Soft", "zh-TW": "偏軟", "zh-CN": "偏软", es: "Suave" },
  ]),
  // Spice Level: None/Mild/Spicy/Extra Spicy match the words
  // packages/api/src/index.js's `sliderValueTranslations` already uses to
  // show a customer's picked value on an order summary (None->無/无/Sin,
  // Mild->微辣/Suave, Spicy->中辣/Picante, Extra Spicy->特辣/Extra Picante),
  // so the picker and the summary agree. "Medium" has no existing
  // translation to match (this is the first 5-step spice scale), so it
  // gets 小辣 ("slightly spicy") / Medio, which sits cleanly between Mild
  // and Spicy: 無 -> 微辣 -> 小辣 -> 中辣 -> 特辣.
  slider03: build([
    { en: "None", "zh-TW": "無", "zh-CN": "无", es: "Sin Picante" },
    { en: "Mild", "zh-TW": "微辣", "zh-CN": "微辣", es: "Suave" },
    { en: "Medium", "zh-TW": "小辣", "zh-CN": "小辣", es: "Medio" },
    { en: "Spicy", "zh-TW": "中辣", "zh-CN": "中辣", es: "Picante" },
    { en: "Extra Spicy", "zh-TW": "特辣", "zh-CN": "特辣", es: "Extra Picante" },
  ]),
  slider04: TOPPING_AMOUNT, // Baby Bok Choy
  slider05: TOPPING_AMOUNT, // Green Onions
  slider06: TOPPING_AMOUNT, // Cilantro
  slider07: TOPPING_AMOUNT, // Sprouts
  slider08: TOPPING_AMOUNT, // Pickled Greens
};
