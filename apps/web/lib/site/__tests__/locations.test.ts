import { describe, expect, it } from "vitest";
import { buildLayout, LOCATION_LAYOUTS } from "@oh/floor-plan";
import { LOCATION_SLUGS, formatHour, orderHref, heroFor, mapsHref, openState, toSiteLocation, weekRows, type ApiLocation } from "../locations";
import { PLAN_LAYOUT, mirrorRect, presetViews } from "@/components/plan/modules/floor-plan/three/layout-context";

const base: ApiLocation = {
  id: "loc-cc",
  name: "City Creek Mall",
  slug: "city-creek",
  city: "Salt Lake City",
  address: "50 S Main St, Salt Lake City, UT 84101",
  lat: 40.77,
  lng: -111.89,
  layoutKey: "comb-75",
  landmarks: "Near Temple Square",
  stats: { availableSeats: 60, totalSeats: 75, avgWaitMinutes: 0 },
  availability: { isOpen: true, canOrder: true },
  hours: {
    timezone: "America/Denver",
    today: "mon",
    week: [
      { day: "mon", open: "11:00", close: "21:00" },
      { day: "tue", open: "11:00", close: "21:00" },
      { day: "wed", open: "11:00", close: "21:00" },
      { day: "thu", open: "11:00", close: "21:00" },
      { day: "fri", open: "11:00", close: "21:00" },
      { day: "sat", open: "11:00", close: "21:00" },
      { day: "sun", open: null, close: null },
    ],
  },
};

describe("location pages: data", () => {
  it("knows the two locations, their order and their hero photos", () => {
    expect(LOCATION_SLUGS).toEqual(["city-creek", "university-place"]);
    expect(heroFor("city-creek")).toBe("sign-pool");
    expect(heroFor("university-place")).toBe("storefront-queue");
  });

  it("open or closed shows only when the API reports real hours (hoursBypassed false)", () => {
    expect(openState({ isOpen: true })).toBeNull(); // before 5b8a2c4: the field is missing, so hide it
    expect(openState({ isOpen: true, openNow: true, hoursBypassed: true })).toBeNull();
    expect(openState({ isOpen: true, openNow: true, hoursBypassed: false })).toBe("open");
    expect(openState({ isOpen: true, openNow: false, hoursBypassed: false })).toBe("closed");
    expect(openState({ hoursBypassed: false })).toBeNull(); // no openNow: never guess
    expect(openState(null)).toBeNull();
  });

  it("maps the API row to the page model, with the pods free from the live stats", () => {
    const loc = toSiteLocation(base)!;
    expect(loc).toMatchObject({ id: "loc-cc", slug: "city-creek", name: "City Creek Mall", layoutKey: "comb-75", podsFree: 60, podsTotal: 75, open: null, hero: "sign-pool" });
    expect(toSiteLocation({ ...base, slug: "soho" })).toBeNull();
    expect(toSiteLocation({ ...base, layoutKey: null })!.layoutKey).toBe("comb-75"); // the slug decides when the row has no key
    expect(toSiteLocation({ ...base, stats: undefined })!.podsFree).toBeNull();
    // English landmarks live only in i18n.en (the API localizes non-English rows only).
    expect(toSiteLocation({ ...base, landmarks: null, i18n: { en: { landmarks: "Near Temple Square" } } }, "en")!.landmarks).toBe("Near Temple Square");
  });

  it("ordering paused (canOrder false) gives no order link", () => {
    expect(toSiteLocation(base)!.canOrder).toBe(true);
    expect(orderHref(toSiteLocation(base)!, "en")).toBe("/en/order/location/loc-cc");
    const paused = toSiteLocation({ ...base, availability: { isOpen: true, canOrder: false } })!;
    expect(paused.canOrder).toBe(false);
    expect(orderHref(paused, "zh-TW")).toBeNull();
    expect(toSiteLocation({ ...base, availability: null })!.canOrder).toBe(true); // unknown: the order flow still enforces it
  });

  it("never invents hours: none from the API means no rows", () => {
    expect(weekRows(undefined, "en")).toEqual([]);
    const rows = weekRows(base.hours, "en");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ day: "mon", today: true, open: "11:00", close: "21:00" });
    expect(rows[6]).toMatchObject({ day: "sun", today: false, open: null });
    expect(rows[0]!.label).toBe("Monday");
    expect(weekRows(base.hours, "zh-TW")[0]!.label).toBe("星期一");
    expect(weekRows(base.hours, "es")[0]!.label.toLowerCase()).toBe("lunes");
  });

  it("formats 24-hour API times in the reader's locale", () => {
    const plain = (s: string) => s.replace(/\s/g, " ");
    expect(plain(formatHour("11:00", "en"))).toBe("11:00 AM");
    expect(plain(formatHour("21:00", "en"))).toBe("9:00 PM");
    expect(formatHour("21:00", "es")).toBe("21:00"); // Spanish uses the 24-hour clock
    expect(formatHour("21:00", "zh-TW")).toMatch(/9:00/);
    expect(formatHour("bad", "en")).toBe("");
  });

  it("links directions to a maps search, with no API key", () => {
    const href = mapsHref("City Creek Mall", "50 S Main St, Salt Lake City, UT 84101");
    expect(href.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(href).toContain(encodeURIComponent("City Creek Mall, 50 S Main St"));
    expect(href).not.toMatch(/key=/);
  });
});

describe("3D scene layout (FloorPlan3D layout prop)", () => {
  it("the plan's presets are the original numbers", () => {
    const v = presetViews(PLAN_LAYOUT);
    expect(v.overview).toEqual({ x: 39, z: 23, viewFt: 122 });
    expect(v.kitchen).toEqual({ x: 23.5, z: 8.5, viewFt: 62 });
    expect(v.lobby.x).toBeGreaterThan(35);
  });

  it("a mirrored layout flips fixtures and presets across the building", () => {
    const up = buildLayout(LOCATION_LAYOUTS["comb-70-mirrored"]);
    expect(up.pods).toHaveLength(70);
    expect(mirrorRect(up, { x: 4, y: 1, w: 7, h: 3 })).toEqual({ x: 59, y: 1, w: 7, h: 3 });
    expect(mirrorRect(PLAN_LAYOUT, { x: 4, y: 1, w: 7, h: 3 })).toEqual({ x: 4, y: 1, w: 7, h: 3 });
    const v = presetViews(up);
    expect(v.kitchen.x).toBe(70 - 23.5);
    expect(v.lobby.x).toBeLessThan(35);
  });
});
