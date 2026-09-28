/**
 * Task F1: menu item names and descriptions in all four locales, for the
 * backfill (scripts/backfill-i18n.ts). MenuItem has no slug, so rows are
 * matched by their English `name`.
 *
 * English: the row's own `description` stays the source of truth. The one
 * exception is `replacesEn`: the catering-era copy ("made fresh at your
 * event", "your guests") that these rows still carried after catering left
 * the customer site. The backfill swaps a description for `en` only when it
 * is exactly one of those known old strings (or empty); any other English
 * is an edit someone made on purpose, so the row is skipped and logged.
 *
 * Per-locale columns (nameZhTW, descriptionEs, ...) are filled only when
 * empty; a translation already in the row is kept.
 *
 * Facts follow the site's own copy (home.signature, home.features.beef):
 * American Wagyu rib chunks and USDA Prime brisket slices, smoked low and
 * slow, over a two-phase bone broth. zh-TW is Taiwan usage, zh-CN mainland
 * usage, es for US and Latin American readers. No em dashes, no emoji.
 *
 * Pure data, safe to import from tests.
 */

export type MenuLocale = "zh-TW" | "zh-CN" | "es";

export interface MenuCopySeed {
  /** The row's English `name` (the match key). */
  name: string;
  /** The English description this row should carry. */
  en?: string;
  /** Old English descriptions (catering era) that may be replaced by `en`. */
  replacesEn?: string[];
  names?: Partial<Record<MenuLocale, string>>;
  descriptions?: Partial<Record<MenuLocale, string>>;
}

export const MENU_COPY: MenuCopySeed[] = [
  {
    name: "American Wagyu Beef Noodle Soup",
    en: "American Wagyu beef rib chunks, smoked low and slow, over our two-phase bone broth.",
    descriptions: {
      "zh-TW": "美國和牛牛肋肉塊，低溫慢燻，配上我們的兩段式牛骨高湯。",
      "zh-CN": "美国和牛牛肋肉块，低温慢熏，配上我们的两段式牛骨高汤。",
      es: "Trozos de costilla de res Wagyu americana, ahumados lento y a baja temperatura, sobre nuestro caldo de hueso en dos fases.",
    },
  },
  {
    name: "Classic Beef Noodle Soup",
    en: "Sliced USDA Prime brisket, smoked low and slow, over our two-phase bone broth.",
    replacesEn: [
      "Thirty years in the making. Tender beef brisket, slow-braised until it falls apart, ladled into a rich broth we simmer for a full 48 hours with star anise, ginger, and warm spices. Our signature bowl, made fresh at your event.",
    ],
    descriptions: {
      "zh-TW": "美國農業部極佳級牛胸肉切片，低溫慢燻，配上我們的兩段式牛骨高湯。",
      "zh-CN": "美国农业部极佳级牛胸肉切片，低温慢熏，配上我们的两段式牛骨高汤。",
      es: "Pecho de res USDA Prime en rebanadas, ahumado lento y a baja temperatura, sobre nuestro caldo de hueso en dos fases.",
    },
  },
  {
    name: "Classic Beef Noodle Soup (no beef)",
    en: "Our classic bowl and broth, made without the beef.",
    replacesEn: [
      "All the warmth and aroma of our signature bowl, prepared without beef. A satisfying, vegan-friendly option so every guest can share in the same comforting bowl.",
    ],
    descriptions: {
      "zh-TW": "經典牛肉麵的湯頭與配料，不加牛肉。",
      "zh-CN": "经典牛肉面的汤头与配料，不加牛肉。",
      es: "Nuestro tazón clásico con su caldo, preparado sin la carne.",
    },
  },
  {
    name: "Wide Noodles",
    en: "Broad, satisfying wheat noodles with a hearty chew. They catch the broth in every fold and are the house favorite for a reason.",
    descriptions: {
      "zh-TW": "寬版小麥麵條，口感扎實有嚼勁。每一道摺痕都吸滿湯汁，是店裡最受歡迎的麵條。",
      "zh-CN": "宽版小麦面条，口感扎实有嚼劲。每一道褶皱都裹满汤汁，是店里最受欢迎的面条。",
      es: "Fideos de trigo anchos y sustanciosos, con una mordida firme. Atrapan el caldo en cada pliegue y son los favoritos de la casa por algo.",
    },
  },
  {
    name: "Wide Noodles (Gluten Free)",
    en: "The same broad, chewy noodle, made from rice and certified gluten free.",
    replacesEn: [
      "The same broad, chewy noodle your guests love, made from rice and certified gluten free. No one has to sit this bowl out.",
    ],
    descriptions: {
      "zh-TW": "同樣寬版、有嚼勁的麵條，以米製成，並通過無麩質認證。",
      "zh-CN": "同样宽版、有嚼劲的面条，以大米制成，并通过无麸质认证。",
      es: "El mismo fideo ancho y firme, hecho de arroz y con certificación sin gluten.",
    },
  },
  {
    // The catering flow still offers this noodle by name (packages/api/src/catering/routes.js),
    // so it is translated rather than retired. The dine-in menu hid it only for lack of names.
    name: "Thin/Flat Noodles",
    en: "Thin, flat ribbons that soak up the broth and cook in moments. A lighter, softer bite.",
    replacesEn: [
      "Silky, delicate ribbons that drink up the broth and cook in moments. A lighter, elegant pick for guests who prefer a softer bite.",
    ],
    names: { "zh-TW": "細扁麵", "zh-CN": "细扁面", es: "Fideos Delgados y Planos" },
    descriptions: {
      "zh-TW": "細薄扁平的麵條，很快就煮好，也很吸湯。口感較輕盈柔軟。",
      "zh-CN": "细薄扁平的面条，熟得快，也很吸汤。口感更轻盈柔软。",
      es: "Cintas delgadas y planas que absorben el caldo y se cocinan en un momento. Una mordida más ligera y suave.",
    },
  },
  {
    name: "No Noodles",
    en: "A full bowl of broth and toppings, with the noodles left out.",
    replacesEn: [
      "Just the good stuff. A full bowl of our signature broth and toppings with the noodles left out, perfect for low-carb guests or anyone who came for the broth.",
    ],
    descriptions: {
      "zh-TW": "滿滿一碗湯頭與配料，不加麵條。",
      "zh-CN": "满满一碗汤头与配料，不加面条。",
      es: "Un tazón completo de caldo y acompañamientos, sin fideos.",
    },
  },
  {
    name: "Baby Bok Choy",
    en: "Tender baby bok choy, blanched to order so it stays crisp and bright green. A fresh, vibrant finish to every bowl.",
    descriptions: {
      "zh-TW": "嫩青江菜，現點現燙，保持爽脆翠綠。為每一碗麵添一分清新。",
      "zh-CN": "嫩小白菜，现点现焯，保持爽脆翠绿。为每一碗面添一分清新。",
      es: "Bok choy tierno, blanqueado al momento para que quede crujiente y de un verde brillante. Un toque fresco para cada tazón.",
    },
  },
  {
    name: "Sprouts",
    en: "Fresh bean sprouts added at the last moment for a clean, crisp crunch against the warm broth.",
    descriptions: {
      "zh-TW": "新鮮豆芽菜，最後一刻才加入，和熱湯形成清爽脆口的對比。",
      "zh-CN": "新鲜豆芽菜，最后一刻才加入，和热汤形成清爽脆口的对比。",
      es: "Brotes de soja frescos, añadidos al último momento para un toque limpio y crujiente contra el caldo caliente.",
    },
  },
];
