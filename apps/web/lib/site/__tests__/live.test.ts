import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_POLL_MS,
  formatClock,
  getLiveStatus,
  hoursToday,
  nearest,
  parseClock,
  resetLiveStatusForTests,
  subscribeLiveStatus,
  toLiveStatus,
} from "../live";
import { directionsUrl, toHomeLocations } from "../home-locations";

describe("toHomeLocations", () => {
  it("maps the API rows onto the two home locations by slug", () => {
    const rows = [
      { id: "u1", slug: "university-place", lat: 40.2, lng: -111.6, address: "575 E University Pkwy, Orem, UT 84097", operatingHours: null, timezone: "America/Denver" },
      { id: "c1", slug: "city-creek", lat: 40.7, lng: -111.9, address: " 50 S Main St ", operatingHours: { mon: null } },
      { id: "x", slug: "other" },
    ];
    const out = toHomeLocations(rows);
    expect(out.map((l) => [l.slug, l.id, l.address, l.directionsTo])).toEqual([
      ["city-creek", "c1", "50 S Main St", "50 S Main St"],
      ["university-place", "u1", "575 E University Pkwy, Orem, UT 84097", "575 E University Pkwy, Orem, UT 84097"],
    ]);
    expect(out[0].operatingHours).toEqual({ mon: null });
  });

  it("fails soft: no API rows still gives both cards, with no ids and a fallback for directions", () => {
    const out = toHomeLocations(null);
    expect(out.map((l) => [l.slug, l.id])).toEqual([
      ["city-creek", null],
      ["university-place", null],
    ]);
    expect(out[0].directionsTo).toMatch(/City Creek/);
  });
});

describe("parseClock", () => {
  it("reads the API's display times and 24-hour times", () => {
    expect(parseClock("9pm")).toBe(21 * 60);
    expect(parseClock("8:45pm")).toBe(20 * 60 + 45);
    expect(parseClock("12am")).toBe(0);
    expect(parseClock("12pm")).toBe(12 * 60);
    expect(parseClock("11:00")).toBe(11 * 60);
    expect(parseClock("21:30")).toBe(21 * 60 + 30);
  });

  it("returns null for anything else, never a guess", () => {
    for (const v of [null, undefined, "", "soon", "13pm", "9:75pm", "25:00", 21]) expect(parseClock(v)).toBe(null);
  });
});

describe("formatClock", () => {
  it("formats in the reader's locale", () => {
    expect(formatClock(21 * 60, "en")).toBe("9 PM");
    expect(formatClock(20 * 60 + 45, "en")).toBe("8:45 PM");
    expect(formatClock(21 * 60, "zh-TW")).toMatch(/9:00/);
    expect(formatClock(21 * 60, "es")).toBe("21:00");
  });
});

describe("toLiveStatus", () => {
  it("counts AVAILABLE seats and parses the closing time", () => {
    const seats = [{ status: "AVAILABLE" }, { status: "OCCUPIED" }, { status: "AVAILABLE" }, { status: "RESERVED" }];
    expect(toLiveStatus({ isOpen: true, closesAt: "9pm", seats })).toEqual({ isOpen: true, closesAt: 1260, podsFree: 2, podsTotal: 4 });
  });

  it("leaves what the API didn't send as null, and returns nothing when nothing is real", () => {
    const seats = [{ status: "AVAILABLE" }];
    expect(toLiveStatus({ isOpen: false, closesAt: "9pm", seats: [] })).toEqual({ isOpen: false, closesAt: 1260, podsFree: null, podsTotal: null });
    expect(toLiveStatus({ isOpen: false, closesAt: null, seats: [] })).toBe(null);
    expect(toLiveStatus({ isOpen: true })).toBe(null);
    expect(toLiveStatus({ seats })).toEqual({ isOpen: null, closesAt: null, podsFree: 1, podsTotal: 1 });
  });

  it("fix round 1: bypassed hours or a missing closing time hide open/closed and the time, never the pods", () => {
    const seats = [{ status: "AVAILABLE" }, { status: "OCCUPIED" }];
    // Time restrictions bypassed: isOpen is forced true and closesAt may be a made-up default.
    expect(toLiveStatus({ isOpen: true, closesAt: "11pm", hoursBypassed: true, seats })).toEqual({ isOpen: null, closesAt: null, podsFree: 1, podsTotal: 2 });
    // No closing time: open/closed can't be trusted either.
    expect(toLiveStatus({ isOpen: true, closesAt: null, seats })).toEqual({ isOpen: null, closesAt: null, podsFree: 1, podsTotal: 2 });
    expect(toLiveStatus({ isOpen: true, seats })).toEqual({ isOpen: null, closesAt: null, podsFree: 1, podsTotal: 2 });
    // hoursBypassed false is the normal case.
    expect(toLiveStatus({ isOpen: true, closesAt: "9pm", hoursBypassed: false, seats })?.isOpen).toBe(true);
  });

  it("rejects a body that isn't an availability response", () => {
    for (const v of [null, "x", {}, { isOpen: "yes" }, { error: "Location not found" }]) expect(toLiveStatus(v)).toBe(null);
  });
});

describe("hoursToday", () => {
  const hours = { mon: { open: "11:00", close: "21:00" }, sun: null };
  // 2026-09-28 is a Monday; 05:00 UTC is still Sunday evening in Denver.
  it("uses the location's time zone to pick the day", () => {
    expect(hoursToday(hours, new Date("2026-09-28T18:00:00Z"))).toEqual({ open: 660, close: 1260 });
    expect(hoursToday(hours, new Date("2026-09-28T05:00:00Z"))).toBe("closed");
  });

  it("is null without usable hours, so the caller shows only open or closed", () => {
    expect(hoursToday(null, new Date())).toBe(null);
    expect(hoursToday({ tue: { open: "11:00", close: "21:00" } }, new Date("2026-09-28T18:00:00Z"))).toBe(null);
    expect(hoursToday({ mon: { open: "late", close: "21:00" } }, new Date("2026-09-28T18:00:00Z"))).toBe(null);
  });
});

describe("nearest and directionsUrl", () => {
  const rows = [
    { slug: "city-creek", lat: 40.7679773, lng: -111.89162 },
    { slug: "university-place", lat: 40.2338, lng: -111.6585 },
    { slug: "nowhere", lat: 0, lng: 0 },
  ];
  it("picks the closer location and ignores missing coordinates", () => {
    expect(nearest({ lat: 40.29, lng: -111.69 }, rows)?.slug).toBe("university-place");
    expect(nearest({ lat: 40.76, lng: -111.9 }, rows)?.slug).toBe("city-creek");
    expect(nearest({ lat: 0.1, lng: 0.1 }, [{ slug: "x", lat: null, lng: null }])).toBe(null);
  });
  it("builds a maps directions link", () => {
    expect(directionsUrl("50 S Main St, Salt Lake City")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=50%20S%20Main%20St%2C%20Salt%20Lake%20City",
    );
  });
});

describe("the shared poller", () => {
  let visibility: "visible" | "hidden" = "visible";
  const docListeners: Array<() => void> = [];
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    docListeners.length = 0;
    vi.stubGlobal("document", {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (_: string, fn: () => void) => docListeners.push(fn),
    });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ isOpen: true, closesAt: "9pm", seats: [{ status: "AVAILABLE" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    resetLiveStatusForTests();
  });

  afterEach(() => {
    resetLiveStatusForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches once for two subscribers, then every 60 s", async () => {
    const off1 = subscribeLiveStatus("loc1", () => {});
    const off2 = subscribeLiveStatus("loc1", () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/locations\/loc1\/availability$/);
    expect(getLiveStatus("loc1")).toEqual({ status: "ready", data: { isOpen: true, closesAt: 1260, podsFree: 1, podsTotal: 1 } });
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    off1();
    off2();
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("pauses while the tab is hidden and refreshes when it comes back", async () => {
    const off = subscribeLiveStatus("loc2", () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    visibility = "hidden";
    docListeners.forEach((fn) => fn());
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    visibility = "visible";
    docListeners.forEach((fn) => fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    off();
  });

  it("drops to error on a failed poll (the pill hides; nothing stale or made up)", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }));
    const off = subscribeLiveStatus("loc3", () => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(getLiveStatus("loc3")).toEqual({ status: "error" });
    off();
  });

  it("no location id is idle and never fetches", () => {
    expect(getLiveStatus(null)).toEqual({ status: "idle" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
