import { describe, expect, it } from "vitest";
import { displayName, fullyNamed, hasName, isEarly, localDescription, localName, marksOf, menuView, orderHref, photoOf, translatedSteps, type ApiMenuItem, type ApiMenuStep } from "../menu";
import { emptyDraft, withPreselectedItem, type MenuStep } from "../order-draft";

const NOW = new Date("2026-09-28T18:00:00Z");

function item(over: Partial<ApiMenuItem> & { id: string; nameEn: string }): ApiMenuItem {
  return {
    name: over.nameEn,
    nameZhTW: `${over.nameEn}-tw`,
    nameZhCN: `${over.nameEn}-cn`,
    nameEs: `${over.nameEn}-es`,
    basePriceCents: 0,
    isAvailable: true,
    ...over,
  };
}

// The shape GET /menu/steps?locale=zh-TW returns (trimmed): `name` and
// `description` are already localized with an English fallback; the raw
// per-locale columns ride along.
const STEPS: ApiMenuStep[] = [
  {
    id: "bowl",
    title: "建立基底",
    sections: [
      {
        id: "soup",
        name: "選擇湯品",
        selectionMode: "SINGLE",
        items: [
          item({ id: "classic", nameEn: "Classic Beef Noodle Soup", name: "經典牛肉麵", nameZhTW: "經典牛肉麵", basePriceCents: 1599, spiceLevel: 1, description: "Thirty years in the making." }),
          item({ id: "wagyu", nameEn: "American Wagyu Beef Noodle Soup", basePriceCents: 2399, releaseAt: "2026-10-01T06:00:00Z" }),
        ],
      },
      {
        id: "noodles",
        name: "選擇麵條",
        selectionMode: "SINGLE",
        items: [
          item({ id: "wide", nameEn: "Wide Noodles", isVegan: true, isVegetarian: true }),
          item({ id: "gf", nameEn: "Wide Noodles (Gluten Free)", isVegan: true, isGlutenFree: true }),
          item({ id: "none", nameEn: "No Noodles" }),
        ],
      },
    ],
  },
  {
    id: "customize",
    title: "客製化",
    sections: [
      {
        id: "spice",
        name: "辣度",
        selectionMode: "SLIDER",
        item: item({ id: "spice", nameEn: "Spice Level" }),
        sliderConfig: { labels: ["None", "Mild", "Medium"], displayLabels: ["無", "微辣", "小辣"], default: 1 },
      },
    ],
  },
  {
    id: "extras",
    title: "加點與小菜",
    sections: [
      { id: "addons", name: "加點", selectionMode: "MULTIPLE", items: [item({ id: "marrow", nameEn: "Bone Marrow", basePriceCents: 399, isGlutenFree: true })] },
      {
        id: "sides",
        name: "小菜",
        selectionMode: "MULTIPLE",
        items: [
          item({ id: "cukes", nameEn: "Spicy Cucumbers", basePriceCents: 299, spiceLevel: 2, isVegan: true }),
          // The stale row: no translations at all.
          { id: "thin", name: "Thin/Flat Noodles", nameEn: "Thin/Flat Noodles", nameZhTW: null, nameZhCN: null, nameEs: null, basePriceCents: 0, isAvailable: true },
          item({ id: "off", nameEn: "Spicy Green Beans", isAvailable: false }),
        ],
      },
    ],
  },
  {
    id: "drinks-desserts",
    title: "飲料與甜點",
    sections: [
      { id: "drinks", name: "飲料", selectionMode: "MULTIPLE", items: [item({ id: "pepsi", nameEn: "Pepsi", basePriceCents: 249 })] },
      { id: "desserts", name: "甜點", selectionMode: "MULTIPLE", items: [] },
    ],
  },
];

describe("menu view (Task D3)", () => {
  it("groups the items by the API's sections, in menu order, dropping empty groups", () => {
    const view = menuView(STEPS, "zh-TW", NOW);
    expect(view.groups.map((g) => g.key)).toEqual(["soup", "noodles", "addons", "sides", "drinks"]);
    expect(view.groups[0].items.map((i) => i.id)).toEqual(["classic", "wagyu"]);
  });

  it("uses the locale's own name column", () => {
    const view = menuView(STEPS, "zh-TW", NOW);
    expect(view.groups[0].items[0].name).toBe("經典牛肉麵");
    expect(menuView(STEPS, "es", NOW).groups[0].items[1].name).toBe("American Wagyu Beef Noodle Soup-es");
    expect(menuView(STEPS, "en", NOW).groups[0].items[0].name).toBe("Classic Beef Noodle Soup");
  });

  it("never shows an English description on a non-English page", () => {
    const classic = STEPS[0].sections[0].items![0];
    expect(localDescription(classic, "en")).toBe("Thirty years in the making.");
    expect(localDescription(classic, "zh-TW")).toBeNull();
    expect(localDescription({ ...classic, descriptionZhTW: "三十年的功夫。" }, "zh-TW")).toBe("三十年的功夫。");
    expect(menuView(STEPS, "zh-TW", NOW).groups[0].items[0].description).toBeNull();
  });

  it("hides No Noodles and unavailable items", () => {
    const ids = menuView(STEPS, "en", NOW).groups.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).not.toContain("none");
    expect(ids).not.toContain("off");
  });

  it("final review I2: an untranslated item is still listed, in English, on every page", () => {
    const thin = STEPS[2].sections[1].items![1];
    expect(fullyNamed(thin)).toBe(false);
    expect(localName(thin, "zh-TW")).toBeNull();
    for (const locale of ["en", "zh-TW", "zh-CN", "es"]) {
      const card = menuView(STEPS, locale, NOW).groups.flatMap((g) => g.items).find((i) => i.id === "thin");
      expect(card?.name, locale).toBe("Thin/Flat Noodles");
    }
    // The locale's own name still wins where there is one.
    expect(displayName({ ...thin, nameEs: "Fideos finos" }, "es")).toBe("Fideos finos");
    expect(displayName({ ...thin, nameEs: "Fideos finos" }, "zh-TW")).toBe("Thin/Flat Noodles");
    // Only a row with no name at all is left out.
    const nameless = { id: "x", name: "  ", nameEn: null, nameZhTW: null, nameZhCN: null, nameEs: null };
    expect(hasName(nameless as never)).toBe(false);
    expect(displayName({ ...nameless, nameZhTW: "只有中文" } as never, "en")).toBe("只有中文");
  });

  it("slider rows show displayLabels, never labels", () => {
    const { sliders } = menuView(STEPS, "zh-TW", NOW);
    expect(sliders).toEqual([{ id: "spice", name: "Spice Level-tw", options: ["無", "微辣", "小辣"], defaultIndex: 1 }]);
    expect(JSON.stringify(sliders)).not.toContain("Mild");
  });

  it("flags items the server sent before their release date as early", () => {
    const soups = menuView(STEPS, "en", NOW).groups[0].items;
    expect(soups.find((i) => i.id === "wagyu")?.early).toBe(true);
    expect(soups.find((i) => i.id === "classic")?.early).toBe(false);
    expect(isEarly({ releaseAt: "2026-09-01T00:00:00Z" }, NOW)).toBe(false);
    expect(isEarly({ releaseAt: null }, NOW)).toBe(false);
    expect(isEarly({ releaseAt: "garbage" }, NOW)).toBe(false);
  });

  it("marks: leaf for vegan or vegetarian, wheat-off for gluten free, flames clamped to 0..3", () => {
    expect(marksOf(item({ id: "a", nameEn: "A", isVegan: true, isVegetarian: true }))).toEqual({ plant: "vegan", glutenFree: false, spice: 0 });
    expect(marksOf(item({ id: "b", nameEn: "B", isVegetarian: true, isGlutenFree: true, spiceLevel: 2 }))).toEqual({ plant: "vegetarian", glutenFree: true, spice: 2 });
    expect(marksOf(item({ id: "c", nameEn: "C", spiceLevel: 9 })).spice).toBe(3);
  });

  it("photos: Classic the slices, Wagyu the chunks, others from lib/menu-images", () => {
    expect(photoOf("Classic Beef Noodle Soup")).toEqual({ kind: "site", key: "bowl-slices-top" });
    expect(photoOf("American Wagyu Beef Noodle Soup")).toEqual({ kind: "site", key: "bowl-chunks-top" });
    expect(photoOf("Bone Marrow")).toEqual({ kind: "file", src: "/menu images/Beef Marrow.png" });
    expect(photoOf("Mystery")).toBeNull();
  });

  it("Order this links to the order flow with the item", () => {
    expect(orderHref("zh-TW", "abc 1")).toBe("/zh-TW/order?item=abc%201");
  });
});

describe("translatedSteps (Task F1: the bowl builder's copy of the rule)", () => {
  it("final review I2: keeps an item that isn't translated everywhere (the API names it in English)", () => {
    const out = translatedSteps(STEPS);
    const ids = out.flatMap((s) => s.sections.flatMap((sec) => (sec.items ?? []).map((i) => i.id)));
    expect(ids).toContain("thin");
    expect(out.map((s) => s.sections.map((sec) => sec.id))).toEqual(STEPS.map((s) => s.sections.map((sec) => sec.id)));
  });

  it("keeps a slider section whose item lacks one locale, and drops only nameless rows", () => {
    const bare = { ...STEPS[1], sections: [{ ...STEPS[1].sections[0], item: { ...STEPS[1].sections[0].item!, nameEs: null } }] };
    expect(translatedSteps([bare])[0].sections).toHaveLength(1);
    const nameless = { ...STEPS[1], sections: [{ ...STEPS[1].sections[0], item: { ...STEPS[1].sections[0].item!, name: "", nameEn: null, nameZhTW: null, nameZhCN: null, nameEs: null } }] };
    expect(translatedSteps([nameless])[0].sections).toEqual([]);
    const input = STEPS[2].sections[1].items!.length;
    translatedSteps(STEPS);
    expect(STEPS[2].sections[1].items!.length).toBe(input); // not mutated
  });
});

describe("withPreselectedItem (Order this)", () => {
  const MENU = STEPS as unknown as MenuStep[];

  it("a soup or noodle becomes that section's choice", () => {
    const { draft, found } = withPreselectedItem({ ...emptyDraft(), singles: { soup: "classic" } }, MENU, "wagyu");
    expect(found).toBe(true);
    expect(draft.singles.soup).toBe("wagyu");
  });

  it("an extra gets at least one, capped by its section", () => {
    const one = withPreselectedItem(emptyDraft(), MENU, "marrow");
    expect(one.draft.extras).toEqual({ marrow: 1 });
    const kept = withPreselectedItem({ ...emptyDraft(), extras: { marrow: 2 } }, MENU, "marrow");
    expect(kept.draft.extras.marrow).toBe(2);
    const capped = [{ ...MENU[2], sections: [{ ...MENU[2].sections[0], maxQuantity: 3 }] }];
    expect(withPreselectedItem({ ...emptyDraft(), extras: { marrow: 9 } }, capped, "marrow").draft.extras.marrow).toBe(3);
  });

  it("an id the menu doesn't offer changes nothing", () => {
    const base = emptyDraft();
    expect(withPreselectedItem(base, MENU, "nope")).toEqual({ draft: base, found: false });
    expect(withPreselectedItem(base, MENU, "off").found).toBe(false);
    expect(withPreselectedItem(base, MENU, "spice").found).toBe(false);
  });
});
