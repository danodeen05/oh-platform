import { describe, expect, it } from "vitest";
import type { MapSeat } from "@/components/site/floor-plan/useSeats";
import { amountDue, arrivesSoon, countdown, decodePods, displayValue, encodePods, nextUnpicked, pickPod, pickRest, seatsForMember } from "../group";

const seat = (label: string, extra: Partial<MapSeat> = {}): MapSeat => ({ id: `s-${label}`, label, status: "AVAILABLE", podType: "SINGLE", ...extra });
const SEATS: MapSeat[] = [
  seat("A-01", { bestRank: 1 }),
  seat("A-02", { bestRank: 2, status: "OCCUPIED" }),
  seat("B-07", { bestRank: 3 }),
  seat("C-01", { bestRank: 4, podType: "DUAL", dualPartnerLabel: "C-02" }),
  seat("C-02", { bestRank: 5, podType: "DUAL", dualPartnerLabel: "C-01" }),
  seat("C-05", { bestRank: 6 }),
];
const IDS = ["o1", "o2", "o3"];

describe("group pod pick (D11)", () => {
  it("another member's pod reads as reserved; your own stays free", () => {
    const shown = seatsForMember(SEATS, { o1: "A-01", o2: "B-07" }, "o1");
    expect(shown.find((s) => s.label === "A-01")?.status).toBe("AVAILABLE");
    expect(shown.find((s) => s.label === "B-07")?.status).toBe("RESERVED");
  });

  it("a tap gives the active member the pod and moves on to the next member without one", () => {
    const r = pickPod(SEATS, IDS, {}, "o1", "B-07");
    expect(r.picks).toEqual({ o1: "B-07" });
    expect(r.active).toBe("o2");
  });

  it("a taken or occupied pod does nothing; tapping your own pod clears it", () => {
    expect(pickPod(SEATS, IDS, { o2: "B-07" }, "o1", "B-07").picks).toEqual({ o2: "B-07" });
    expect(pickPod(SEATS, IDS, {}, "o1", "A-02").picks).toEqual({});
    expect(pickPod(SEATS, IDS, { o1: "B-07" }, "o1", "B-07").picks).toEqual({});
  });

  it("a duo half seats the next member at the other half", () => {
    const r = pickPod(SEATS, IDS, {}, "o1", "C-02");
    expect(r.picks).toEqual({ o1: "C-02", o2: "C-01" });
    expect(r.active).toBe("o3");
  });

  it("pick the rest: a free duo for two, then the best single pods, never twice the same pod", () => {
    const all = pickRest(SEATS, IDS, { o1: "A-01" });
    expect(all).toEqual({ o1: "A-01", o2: "C-01", o3: "C-02" });
    const solo = pickRest(SEATS, ["o1"], {});
    expect(solo).toEqual({ o1: "A-01" });
    expect(new Set(Object.values(pickRest(SEATS, ["a", "b", "c", "d", "e"], {}))).size).toBe(5);
  });

  it("nextUnpicked wraps and ends", () => {
    expect(nextUnpicked(IDS, { o2: "A-01" }, "o3")).toBe("o1");
    expect(nextUnpicked(IDS, { o1: "x", o2: "y", o3: "z" }, "o1")).toBeNull();
  });

  it("pods round-trip through the URL and junk is dropped", () => {
    const v = encodePods({ o1: "B-07", o2: "C-01", bad: "nope" });
    expect(v).toBe("o1:B-07,o2:C-01");
    expect(decodePods(v)).toEqual({ o1: "B-07", o2: "C-01" });
    expect(decodePods("x:<script>,o1:B-07,:A-01")).toEqual({ o1: "B-07" });
  });
});

describe("group lobby reads", () => {
  it("amount due is each unpaid live order's server-quoted amount", () => {
    const o = (p: string, due: number | null, total: number, status = "PENDING_PAYMENT") =>
      ({ id: p, paymentStatus: p, status, amountDueCents: due, totalCents: total }) as never;
    expect(amountDue([o("PAID", 100, 100), o("PENDING", 900, 1000), o("PENDING", null, 500), o("PENDING", 50, 50, "CANCELLED")])).toBe(1400);
  });

  it("arrival: none or soon means pick now; later means the kiosk", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    expect(arrivesSoon(null, now)).toBe(true);
    expect(arrivesSoon("2026-09-28T12:20:00Z", now)).toBe(true);
    expect(arrivesSoon("2026-09-28T13:00:00Z", now)).toBe(false);
  });

  it("countdown and slider display values", () => {
    expect(countdown(754)).toBe("12:34");
    expect(countdown(-3)).toBe("0:00");
    const item = { selectedValue: "Medium", menuItem: { sliderConfig: { labels: ["Light", "Medium"], displayLabels: ["淡", "中"] } } } as never;
    expect(displayValue(item)).toBe("中");
  });
});
