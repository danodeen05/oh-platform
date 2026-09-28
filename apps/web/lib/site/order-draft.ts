/**
 * The order flow's draft cart (Task D5).
 *
 * One JSON object in sessionStorage under `oh-order-draft`, so the cart
 * survives a locale switch (a full navigation to /{locale}/...), a Clerk
 * sign-in and a reload, and is gone when the tab closes. Pure functions: the
 * React side is `useOrderDraft` in components/site/order/useOrderDraft.ts.
 *
 * Money is never computed here. `buildLines` turns the draft into the
 * `{menuItemId, quantity, selectedValue}` lines the API prices
 * (POST /orders/quote and POST /orders); every total on screen comes from
 * the server's quote.
 *
 * Slider lines send `sliderConfig.labels[i]` (English, the kitchen's value)
 * as `selectedValue`, never the translated `displayLabels[i]`.
 */

export const DRAFT_KEY = "oh-order-draft";

export const ORDER_STEPS = ["location", "bowl", "arrival", "pod", "savings", "pay"] as const;
export type OrderStepKey = (typeof ORDER_STEPS)[number];

/** Steps that need a signed-in member (owner decision: guests sign in to order). */
export const SIGNED_IN_STEPS: readonly OrderStepKey[] = ["arrival", "pod", "savings", "pay"];

export type PodChoice = { mode: "best" } | { mode: "pick"; label: string };

export interface DraftSavings {
  useCredits: boolean;
  promoCode: string | null;
  giftCardCode: string | null;
  rewardId: string | null;
}

export interface DraftOrderRef {
  id: string;
  orderNumber: string;
  /** draftSignature() of what the order was created from. */
  signature: string;
}

export interface OrderDraft {
  v: 1;
  locationId: string | null;
  /** SINGLE sections: section id -> chosen menu item id. */
  singles: Record<string, string>;
  /** SLIDER items: menu item id -> index into sliderConfig.labels. */
  sliders: Record<string, number>;
  /** MULTIPLE sections: menu item id -> quantity. */
  extras: Record<string, number>;
  /** "asap" or minutes from now ("15", "30", ...), as GET /locations/:id/availability lists them. */
  arrival: string | null;
  partySize: 1 | 2;
  pod: PodChoice;
  savings: DraftSavings;
  /** The unpaid order this draft already created, so Back and reload don't create another. */
  order: DraftOrderRef | null;
}

export interface MenuItem {
  id: string;
  name: string;
  nameEn?: string;
  basePriceCents: number;
  additionalPriceCents?: number;
  includedQuantity?: number;
  categoryType?: string;
  category?: string;
  description?: string | null;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number;
}

export interface SliderConfig {
  min?: number;
  max?: number;
  default?: number;
  labels?: string[];
  displayLabels?: string[];
  description?: string;
}

export interface MenuSection {
  id: string;
  name: string;
  description?: string | null;
  selectionMode: "SINGLE" | "MULTIPLE" | "SLIDER" | string;
  required?: boolean;
  items?: MenuItem[];
  item?: MenuItem;
  sliderConfig?: SliderConfig | null;
  maxQuantity?: number | null;
}

export interface MenuStep {
  id: string;
  title: string;
  sections: MenuSection[];
}

export type OrderLine = { menuItemId: string; quantity: number; selectedValue?: string | null };

export function emptyDraft(): OrderDraft {
  return {
    v: 1,
    locationId: null,
    singles: {},
    sliders: {},
    extras: {},
    arrival: null,
    partySize: 1,
    pod: { mode: "best" },
    savings: { useCredits: false, promoCode: null, giftCardCode: null, rewardId: null },
    order: null,
  };
}

function isRecordOf<T>(v: unknown, ok: (x: unknown) => x is T): v is Record<string, T> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every(ok);
}
const isString = (x: unknown): x is string => typeof x === "string";
const isCount = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 20;

/** Parses a stored draft; anything malformed becomes an empty draft rather than a crash. */
export function parseDraft(raw: string | null | undefined): OrderDraft {
  const base = emptyDraft();
  if (!raw) return base;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!d || typeof d !== "object" || d.v !== 1) return base;
  const pod = d.pod as PodChoice | undefined;
  const savings = (d.savings || {}) as Partial<DraftSavings>;
  const order = d.order as DraftOrderRef | null | undefined;
  return {
    v: 1,
    locationId: isString(d.locationId) ? d.locationId : null,
    singles: isRecordOf(d.singles, isString) ? d.singles : {},
    sliders: isRecordOf(d.sliders, isCount) ? d.sliders : {},
    extras: isRecordOf(d.extras, isCount) ? d.extras : {},
    arrival: isString(d.arrival) ? d.arrival : null,
    partySize: d.partySize === 2 ? 2 : 1,
    pod: pod && pod.mode === "pick" && isString(pod.label) ? { mode: "pick", label: pod.label } : { mode: "best" },
    savings: {
      useCredits: savings.useCredits === true,
      promoCode: isString(savings.promoCode) ? savings.promoCode : null,
      giftCardCode: isString(savings.giftCardCode) ? savings.giftCardCode : null,
      rewardId: isString(savings.rewardId) ? savings.rewardId : null,
    },
    order: order && isString(order.id) && isString(order.orderNumber) && isString(order.signature) ? order : null,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadDraft(storage: StorageLike | null | undefined): OrderDraft {
  try {
    return parseDraft(storage?.getItem(DRAFT_KEY));
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(storage: StorageLike | null | undefined, draft: OrderDraft): void {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage full or blocked: the flow still works for this page view */
  }
}

export function clearDraft(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** The English name the images and defaults key on (the API sends `name` localized). */
export function englishName(item: Pick<MenuItem, "name" | "nameEn">): string {
  return item.nameEn || item.name;
}

const DEFAULT_SINGLE: Record<string, string> = {
  soup: "Classic Beef Noodle Soup",
  noodles: "Wide Noodles",
};

/**
 * Fills what the menu requires and the draft lacks: a choice for every
 * required SINGLE section (the house default, else the first item) and the
 * default of every slider. Drops ids the menu no longer has.
 */
export function withMenuDefaults(draft: OrderDraft, steps: MenuStep[]): OrderDraft {
  const singles: Record<string, string> = {};
  const sliders: Record<string, number> = {};
  const extras: Record<string, number> = {};
  for (const step of steps) {
    for (const section of step.sections) {
      if (section.selectionMode === "SINGLE") {
        const items = (section.items || []).filter((i) => i.isAvailable !== false);
        const kept = items.find((i) => i.id === draft.singles[section.id]);
        const preferred = items.find((i) => englishName(i) === DEFAULT_SINGLE[section.id]);
        const pick = kept || (section.required ? preferred || items[0] : undefined);
        if (pick) singles[section.id] = pick.id;
      } else if (section.selectionMode === "SLIDER" && section.item) {
        const labels = section.sliderConfig?.labels || [];
        const max = Math.max(0, labels.length - 1);
        const stored = draft.sliders[section.item.id];
        const fallback = Math.min(max, Math.max(0, section.sliderConfig?.default ?? 0));
        sliders[section.item.id] = typeof stored === "number" && stored <= max ? stored : fallback;
      } else if (section.selectionMode === "MULTIPLE") {
        for (const item of section.items || []) {
          const q = draft.extras[item.id];
          const cap = section.maxQuantity ?? 20;
          if (q && item.isAvailable !== false) extras[item.id] = Math.min(q, cap);
        }
      }
    }
  }
  return { ...draft, singles, sliders, extras };
}

/**
 * The lines the API prices. SINGLE choices are quantity 1; every slider is
 * sent (quantity is its index, as the kitchen reads it, with the English
 * label as `selectedValue`); extras only when their quantity is above 0.
 */
export function buildLines(draft: OrderDraft, steps: MenuStep[]): OrderLine[] {
  const lines: OrderLine[] = [];
  for (const step of steps) {
    for (const section of step.sections) {
      if (section.selectionMode === "SINGLE") {
        const id = draft.singles[section.id];
        if (id && (section.items || []).some((i) => i.id === id)) lines.push({ menuItemId: id, quantity: 1 });
      } else if (section.selectionMode === "SLIDER" && section.item) {
        const idx = draft.sliders[section.item.id];
        const labels = section.sliderConfig?.labels || [];
        if (typeof idx === "number" && labels[idx] !== undefined) {
          lines.push({ menuItemId: section.item.id, quantity: idx, selectedValue: labels[idx] });
        }
      } else if (section.selectionMode === "MULTIPLE") {
        for (const item of section.items || []) {
          const q = draft.extras[item.id] || 0;
          if (q > 0) lines.push({ menuItemId: item.id, quantity: q });
        }
      }
    }
  }
  return lines;
}

/**
 * The lines a price preview needs: everything but the slider choices, which
 * are always free and would otherwise re-quote on every tap (the API allows
 * 100 requests a minute per visitor). The order itself is created from the
 * full `buildLines`, and the server re-prices it there.
 */
export function quoteLines(lines: OrderLine[], steps: MenuStep[]): OrderLine[] {
  const sliders = new Set(steps.flatMap((s) => s.sections).filter((sec) => sec.selectionMode === "SLIDER" && sec.item).map((sec) => sec.item!.id));
  return lines.filter((l) => !sliders.has(l.menuItemId));
}

/** True when every required section has a choice (the bowl step's CTA). */
export function bowlComplete(draft: OrderDraft, steps: MenuStep[]): boolean {
  return steps.every((s) => s.sections.every((sec) => sec.selectionMode !== "SINGLE" || !sec.required || Boolean(draft.singles[sec.id])));
}

/** The savings the API takes, from the draft (credits: up to the per-order cap; the server clamps). */
export function savingsBody(savings: DraftSavings, maxCreditsCents: number) {
  return {
    useCreditsCents: savings.useCredits ? maxCreditsCents : 0,
    promoCode: savings.promoCode || null,
    giftCardCode: savings.giftCardCode || null,
    rewardId: savings.rewardId || null,
  };
}

/**
 * What an order is made of. An unpaid order created from the same signature
 * is reused; any change (cart, arrival, pod, savings) makes a new one.
 */
export function draftSignature(draft: OrderDraft, lines: OrderLine[]): string {
  return JSON.stringify([draft.locationId, lines, draft.arrival, draft.partySize, draft.pod, draft.savings]);
}

/** estimatedArrival for POST /orders: now for "asap", else now plus the minutes. */
export function arrivalIso(arrival: string | null, now: Date = new Date()): string | null {
  if (!arrival) return null;
  if (arrival === "asap") return now.toISOString();
  const minutes = Number(arrival);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/** The seat request for POST /orders. */
export function seatRequest(pod: PodChoice): { best: true } | { label: string } {
  return pod.mode === "pick" ? { label: pod.label } : { best: true };
}

/** A cart line from a past order, placed back into the draft by the menu's structure (reorder). */
export function draftFromOrderItems(
  base: OrderDraft,
  steps: MenuStep[],
  items: { menuItemId: string; quantity: number; selectedValue?: string | null }[],
): OrderDraft {
  const next: OrderDraft = { ...base, singles: {}, sliders: {}, extras: {}, order: null };
  for (const step of steps) {
    for (const section of step.sections) {
      if (section.selectionMode === "SINGLE") {
        const hit = items.find((it) => (section.items || []).some((i) => i.id === it.menuItemId));
        if (hit) next.singles[section.id] = hit.menuItemId;
      } else if (section.selectionMode === "SLIDER" && section.item) {
        const hit = items.find((it) => it.menuItemId === section.item!.id);
        const labels = section.sliderConfig?.labels || [];
        if (hit) {
          const byLabel = hit.selectedValue ? labels.indexOf(hit.selectedValue) : -1;
          next.sliders[section.item.id] = byLabel >= 0 ? byLabel : Math.min(hit.quantity, Math.max(0, labels.length - 1));
        }
      } else if (section.selectionMode === "MULTIPLE") {
        for (const item of section.items || []) {
          const hit = items.find((it) => it.menuItemId === item.id);
          if (hit && hit.quantity > 0) next.extras[item.id] = Math.min(hit.quantity, section.maxQuantity ?? 20);
        }
      }
    }
  }
  return withMenuDefaults(next, steps);
}
