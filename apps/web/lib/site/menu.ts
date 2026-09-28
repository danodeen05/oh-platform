/**
 * The menu page's data (Task D3): GET /menu/steps?locale= turned into the
 * panels the page draws. Pure functions, unit-tested in
 * __tests__/menu.test.ts.
 *
 *  - Groups follow the API's section ids: soup, noodles, the slider items
 *    ("make it yours"), add-ons, sides, drinks, desserts.
 *  - Names and descriptions come from the per-locale columns
 *    (nameZhTW/descriptionZhTW, ...). The API's `description` falls back to
 *    English, so the page reads the locale's own column and never shows an
 *    English description on a zh or es page (the sheet uses a translated
 *    group line instead).
 *  - An item is listed only when it has a name in every site locale, so no
 *    page ever shows an untranslated English name. (It hid "Thin/Flat
 *    Noodles" until Task F1's backfill gave that row its names.) The order
 *    flow applies the same rule through translatedSteps().
 *  - Slider rows show `sliderConfig.displayLabels` (F1a), never `labels`.
 *  - Early access: /menu/steps already filters by the caller's tier, so an
 *    item whose `releaseAt` is still ahead was sent only because this
 *    member's tier reaches it early. Those are flagged `early`.
 */
import { SITE_IMAGES, type ImageKey } from "./images";
import { getMenuItemImage } from "../menu-images";

export const MENU_GROUPS = ["soup", "noodles", "customize", "addons", "sides", "drinks", "desserts"] as const;
export type MenuGroupKey = (typeof MENU_GROUPS)[number];

/** The raw item as GET /menu/steps sends it (every column, plus the localized `name` and `nameEn`). */
export interface ApiMenuItem {
  id: string;
  name: string;
  nameEn?: string;
  nameZhTW?: string | null;
  nameZhCN?: string | null;
  nameEs?: string | null;
  description?: string | null;
  descriptionZhTW?: string | null;
  descriptionZhCN?: string | null;
  descriptionEs?: string | null;
  basePriceCents: number;
  category?: string | null;
  categoryType?: string | null;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number;
  releaseAt?: string | null;
  sliderConfig?: { labels?: string[]; displayLabels?: string[]; default?: number } | null;
}

export interface ApiMenuSection {
  id: string;
  name: string;
  selectionMode: string;
  items?: ApiMenuItem[];
  item?: ApiMenuItem;
  sliderConfig?: ApiMenuItem["sliderConfig"];
}

export interface ApiMenuStep {
  id: string;
  title: string;
  sections: ApiMenuSection[];
}

export type MenuPhoto = { kind: "site"; key: ImageKey } | { kind: "file"; src: string };

export interface MenuMarks {
  /** Vegetarian or vegan (the leaf). */
  plant: "vegan" | "vegetarian" | null;
  glutenFree: boolean;
  /** 0 to 3 flames. */
  spice: number;
}

export interface MenuCard {
  id: string;
  group: MenuGroupKey;
  name: string;
  /** The English name (images and the house defaults key on it). */
  nameEn: string;
  /** This locale's own description, or null (never an English fallback on a non-English page). */
  description: string | null;
  priceCents: number;
  marks: MenuMarks;
  early: boolean;
  photo: MenuPhoto | null;
}

export interface MenuSliderRow {
  id: string;
  name: string;
  /** `sliderConfig.displayLabels` (localized). */
  options: string[];
  defaultIndex: number;
}

export interface MenuGroup {
  key: MenuGroupKey;
  items: MenuCard[];
}

export interface MenuView {
  groups: MenuGroup[];
  sliders: MenuSliderRow[];
}

/** Classic shows the sliced brisket, Wagyu the chunks (C6 photography). */
const SITE_PHOTO: Record<string, ImageKey> = {
  "Classic Beef Noodle Soup": "bowl-slices-top",
  "American Wagyu Beef Noodle Soup": "bowl-chunks-top",
};

const HIDDEN = new Set(["No Noodles"]);

const SECTION_GROUP: Record<string, MenuGroupKey> = {
  soup: "soup",
  noodles: "noodles",
  addons: "addons",
  sides: "sides",
  drinks: "drinks",
  desserts: "desserts",
};

/** Just the name columns (the kiosk check-in reads these off an order line, Task F1). */
export type NamedMenuItem = Pick<ApiMenuItem, "name" | "nameEn" | "nameZhTW" | "nameZhCN" | "nameEs">;

function englishOf(item: NamedMenuItem): string {
  return item.nameEn || item.name;
}

function trimmed(v: string | null | undefined): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

/** The item's name in `locale` from its own column, or null when that column is empty. */
export function localName(item: NamedMenuItem, locale: string): string | null {
  switch (locale) {
    case "zh-TW":
      return trimmed(item.nameZhTW);
    case "zh-CN":
      return trimmed(item.nameZhCN);
    case "es":
      return trimmed(item.nameEs);
    default:
      return trimmed(englishOf(item));
  }
}

/** The item's description in `locale` from its own column (no English fallback). */
export function localDescription(item: ApiMenuItem, locale: string): string | null {
  switch (locale) {
    case "zh-TW":
      return trimmed(item.descriptionZhTW);
    case "zh-CN":
      return trimmed(item.descriptionZhCN);
    case "es":
      return trimmed(item.descriptionEs);
    default:
      return trimmed(item.description);
  }
}

/** Translated in every site locale, so it can be listed on any page. */
export function fullyNamed(item: ApiMenuItem): boolean {
  return ["en", "zh-TW", "zh-CN", "es"].every((l) => localName(item, l) !== null);
}

/**
 * The order flow's copy of the same rule (Task F1): GET /menu/steps with every
 * item that lacks a name in some site locale removed, so the bowl builder
 * never offers an untranslated English name on a zh or es page. A slider
 * section whose item isn't fully named is dropped too.
 */
export function translatedSteps<Step extends { sections: Array<{ items?: unknown[]; item?: unknown }> }>(steps: Step[]): Step[] {
  const named = (i: unknown) => fullyNamed(i as ApiMenuItem);
  return steps.map(
    (step) =>
      ({
        ...step,
        sections: step.sections
          .filter((s) => !s.item || named(s.item))
          .map((s) => (Array.isArray(s.items) ? { ...s, items: s.items.filter(named) } : s)),
      }) as Step,
  );
}

/** Sent to us before its release date: this member's tier sees it early. */
export function isEarly(item: Pick<ApiMenuItem, "releaseAt">, now: Date = new Date()): boolean {
  if (!item.releaseAt) return false;
  const at = new Date(item.releaseAt);
  return !Number.isNaN(at.getTime()) && at.getTime() > now.getTime();
}

export function marksOf(item: ApiMenuItem): MenuMarks {
  const spice = Math.max(0, Math.min(3, Math.round(Number(item.spiceLevel) || 0)));
  return {
    plant: item.isVegan ? "vegan" : item.isVegetarian ? "vegetarian" : null,
    glutenFree: Boolean(item.isGlutenFree),
    spice,
  };
}

export function photoOf(nameEn: string): MenuPhoto | null {
  const site = SITE_PHOTO[nameEn];
  if (site && SITE_IMAGES[site]) return { kind: "site", key: site };
  const src = getMenuItemImage(nameEn);
  return src ? { kind: "file", src } : null;
}

function card(item: ApiMenuItem, group: MenuGroupKey, locale: string, now: Date): MenuCard | null {
  if (item.isAvailable === false) return null;
  const nameEn = englishOf(item);
  if (HIDDEN.has(nameEn) || !fullyNamed(item)) return null;
  return {
    id: item.id,
    group,
    name: localName(item, locale) as string,
    nameEn,
    description: localDescription(item, locale),
    priceCents: Math.max(0, Number(item.basePriceCents) || 0),
    marks: marksOf(item),
    early: isEarly(item, now),
    photo: photoOf(nameEn),
  };
}

/** The page's view of the menu: the groups that have items, in menu order, and the slider rows. */
export function menuView(steps: ApiMenuStep[], locale: string, now: Date = new Date()): MenuView {
  const byGroup = new Map<MenuGroupKey, MenuCard[]>();
  const sliders: MenuSliderRow[] = [];
  const seen = new Set<string>();
  for (const step of steps || []) {
    for (const section of step.sections || []) {
      if (section.selectionMode === "SLIDER") {
        const item = section.item;
        if (!item || item.isAvailable === false || !fullyNamed(item) || seen.has(item.id)) continue;
        const config = section.sliderConfig || item.sliderConfig || null;
        const options = (config?.displayLabels || []).filter((o): o is string => typeof o === "string" && o.length > 0);
        if (!options.length) continue;
        seen.add(item.id);
        const d = Number(config?.default ?? 0);
        sliders.push({ id: item.id, name: localName(item, locale) as string, options, defaultIndex: Number.isInteger(d) && d >= 0 && d < options.length ? d : 0 });
        continue;
      }
      const group = SECTION_GROUP[section.id];
      if (!group) continue;
      for (const item of section.items || []) {
        if (seen.has(item.id)) continue;
        const c = card(item, group, locale, now);
        if (!c) continue;
        seen.add(item.id);
        const list = byGroup.get(group) || [];
        list.push(c);
        byGroup.set(group, list);
      }
    }
  }
  const groups: MenuGroup[] = [];
  for (const key of MENU_GROUPS) {
    if (key === "customize") continue;
    const items = byGroup.get(key);
    if (items?.length) groups.push({ key, items });
  }
  return { groups, sliders };
}

/** The order flow link for "Order this": the order starts at the location step with this item preselected. */
export function orderHref(locale: string, itemId: string): string {
  return `/${locale}/order?item=${encodeURIComponent(itemId)}`;
}
