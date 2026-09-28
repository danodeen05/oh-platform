import { describe, expect, it } from "vitest";
import {
  DRAFT_KEY,
  arrivalIso,
  bowlComplete,
  buildLines,
  canReuseOrder,
  draftFromOrderItems,
  draftSignature,
  emptyDraft,
  loadDraft,
  parseDraft,
  quoteLines,
  saveDraft,
  savingsBody,
  seatRequest,
  withMenuDefaults,
  type MenuStep,
} from "../order-draft";

// The shape GET /menu/steps?locale=zh-TW returns (trimmed).
const MENU: MenuStep[] = [
  {
    id: "bowl",
    title: "建立基底",
    sections: [
      {
        id: "soup",
        name: "選擇湯品",
        selectionMode: "SINGLE",
        required: true,
        items: [
          { id: "wagyu", name: "美國和牛牛肉麵", nameEn: "American Wagyu Beef Noodle Soup", basePriceCents: 2399 },
          { id: "classic", name: "經典牛肉麵", nameEn: "Classic Beef Noodle Soup", basePriceCents: 1599 },
        ],
      },
      {
        id: "noodles",
        name: "選擇麵條",
        selectionMode: "SINGLE",
        required: true,
        items: [
          { id: "ramen", name: "拉麵", nameEn: "Ramen Noodles", basePriceCents: 0 },
          { id: "wide", name: "寬麵", nameEn: "Wide Noodles", basePriceCents: 0 },
        ],
      },
    ],
  },
  {
    id: "customize",
    title: "客製",
    sections: [
      {
        id: "spice",
        name: "辣度",
        selectionMode: "SLIDER",
        item: { id: "spice-item", name: "辣度", nameEn: "Spice Level", basePriceCents: 0 },
        sliderConfig: { labels: ["None", "Mild", "Medium"], displayLabels: ["無", "微辣", "小辣"], default: 1 },
      },
    ],
  },
  {
    id: "extras",
    title: "加購",
    sections: [
      {
        id: "addons",
        name: "精選加購",
        selectionMode: "MULTIPLE",
        maxQuantity: 3,
        items: [{ id: "egg", name: "滷蛋", nameEn: "Soft-Boild Egg", basePriceCents: 199 }],
      },
    ],
  },
];

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe("order draft", () => {
  it("is stored under oh-order-draft and round-trips", () => {
    const s = memoryStorage();
    const d = { ...emptyDraft(), locationId: "loc", extras: { egg: 2 }, arrival: "15" };
    saveDraft(s, d);
    expect(s.raw.has(DRAFT_KEY)).toBe(true);
    expect(loadDraft(s)).toEqual(d);
  });

  it("treats malformed or foreign JSON as an empty draft", () => {
    expect(parseDraft("{nope")).toEqual(emptyDraft());
    expect(parseDraft(JSON.stringify({ v: 2 }))).toEqual(emptyDraft());
    const bad = parseDraft(JSON.stringify({ v: 1, extras: { egg: -1 }, pod: { mode: "pick" }, partySize: 9 }));
    expect(bad.extras).toEqual({});
    expect(bad.pod).toEqual({ mode: "best" });
    expect(bad.partySize).toBe(1);
  });

  it("defaults: Classic soup, wide noodles, slider defaults; keeps a valid stored choice", () => {
    const d = withMenuDefaults(emptyDraft(), MENU);
    expect(d.singles).toEqual({ soup: "classic", noodles: "wide" });
    expect(d.sliders).toEqual({ "spice-item": 1 });
    const kept = withMenuDefaults({ ...emptyDraft(), singles: { soup: "wagyu" }, sliders: { "spice-item": 2 }, extras: { egg: 9, gone: 1 } }, MENU);
    expect(kept.singles.soup).toBe("wagyu");
    expect(kept.sliders["spice-item"]).toBe(2);
    expect(kept.extras).toEqual({ egg: 3 });
  });

  it("builds lines that send the English slider label, never the translated one", () => {
    const d = withMenuDefaults({ ...emptyDraft(), extras: { egg: 2 } }, MENU);
    expect(buildLines(d, MENU)).toEqual([
      { menuItemId: "classic", quantity: 1 },
      { menuItemId: "wide", quantity: 1 },
      { menuItemId: "spice-item", quantity: 1, selectedValue: "Mild" },
      { menuItemId: "egg", quantity: 2 },
    ]);
  });

  it("previews prices without the free slider lines (no re-quote per slider tap)", () => {
    const d = withMenuDefaults({ ...emptyDraft(), extras: { egg: 1 } }, MENU);
    expect(quoteLines(buildLines(d, MENU), MENU).map((l) => l.menuItemId)).toEqual(["classic", "wide", "egg"]);
  });

  it("needs every required choice before the bowl can continue", () => {
    expect(bowlComplete(emptyDraft(), MENU)).toBe(false);
    expect(bowlComplete(withMenuDefaults(emptyDraft(), MENU), MENU)).toBe(true);
  });

  it("signature changes with the cart, arrival, pod or savings", () => {
    const d = withMenuDefaults({ ...emptyDraft(), locationId: "loc", arrival: "asap" }, MENU);
    const sig = draftSignature(d, buildLines(d, MENU));
    expect(draftSignature(d, buildLines(d, MENU))).toBe(sig);
    expect(draftSignature({ ...d, arrival: "15" }, buildLines(d, MENU))).not.toBe(sig);
    expect(draftSignature({ ...d, pod: { mode: "pick", label: "A-03" } }, buildLines(d, MENU))).not.toBe(sig);
    expect(draftSignature({ ...d, savings: { ...d.savings, rewardId: "r" } }, buildLines(d, MENU))).not.toBe(sig);
  });

  it("maps the API's request fields", () => {
    expect(seatRequest({ mode: "best" })).toEqual({ best: true });
    expect(seatRequest({ mode: "pick", label: "A-03" })).toEqual({ label: "A-03" });
    // Credits ask for the stored balance; the server applies its own per-order cap.
    expect(savingsBody({ useCredits: true, creditsCents: 700, promoCode: "", giftCardCode: "GC", rewardId: null, mealGiftId: "mg1" })).toEqual({
      useCreditsCents: 700,
      promoCode: null,
      giftCardCode: "GC",
      rewardId: null,
      mealGiftId: "mg1",
    });
    expect(savingsBody({ useCredits: false, creditsCents: 700, promoCode: null, giftCardCode: null, rewardId: null, mealGiftId: null }).useCreditsCents).toBe(0);
    const now = new Date("2026-11-01T18:00:00Z");
    expect(arrivalIso("asap", now)).toBe("2026-11-01T18:00:00.000Z");
    expect(arrivalIso("30", now)).toBe("2026-11-01T18:30:00.000Z");
    expect(arrivalIso(null, now)).toBeNull();
  });

  it("reuses an unpaid order only when unchanged, recent, and its arrival still stands", () => {
    const t0 = Date.parse("2026-09-28T18:00:00Z");
    const ref = { id: "o1", orderNumber: "N", signature: "sig", createdAt: t0, arrivalIso: "2026-09-28T18:15:00.000Z" };
    const ok = { now: t0 + 60_000, arrival: "15", offered: ["asap", "15", "30"], canOrder: true };
    expect(canReuseOrder(ref, "sig", ok)).toBe(true);
    expect(canReuseOrder(null, "sig", ok)).toBe(false);
    expect(canReuseOrder(ref, "other", ok), "the cart changed").toBe(false);
    expect(canReuseOrder(ref, "sig", { ...ok, now: t0 + 11 * 60_000 }), "older than 10 minutes").toBe(false);
    expect(canReuseOrder(ref, "sig", { ...ok, now: t0 + 16 * 60_000 }), "the arrival time passed").toBe(false);
    expect(canReuseOrder(ref, "sig", { ...ok, canOrder: false }), "ordering closed").toBe(false);
    expect(canReuseOrder(ref, "sig", { ...ok, offered: ["asap", "30"] }), "choice no longer offered").toBe(false);
    expect(canReuseOrder({ ...ref, arrivalIso: null }, "sig", { ...ok, arrival: "asap" })).toBe(true);
  });

  it("switches off a stored 'use credit' that has no requested amount (an older draft)", () => {
    const old = parseDraft(JSON.stringify({ v: 1, savings: { useCredits: true } }));
    expect(old.savings.useCredits).toBe(false);
    const current = parseDraft(JSON.stringify({ v: 1, savings: { useCredits: true, creditsCents: 700 } }));
    expect(current.savings).toMatchObject({ useCredits: true, creditsCents: 700 });
  });

  it("drops a stored order ref from before this format (no createdAt)", () => {
    const old = parseDraft(JSON.stringify({ v: 1, order: { id: "o1", orderNumber: "N", signature: "s" } }));
    expect(old.order).toBeNull();
  });

  it("places a past order's items back into the builder (reorder)", () => {
    const d = draftFromOrderItems(emptyDraft(), MENU, [
      { menuItemId: "wagyu", quantity: 1 },
      { menuItemId: "ramen", quantity: 1 },
      { menuItemId: "spice-item", quantity: 0, selectedValue: "Medium" },
      { menuItemId: "egg", quantity: 1 },
    ]);
    expect(d.singles).toEqual({ soup: "wagyu", noodles: "ramen" });
    expect(d.sliders).toEqual({ "spice-item": 2 });
    expect(d.extras).toEqual({ egg: 1 });
  });
});
