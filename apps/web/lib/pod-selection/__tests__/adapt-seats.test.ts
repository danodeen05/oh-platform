/**
 * Task A8 fix round 1 (Critical): GET /locations/:id/seats now returns
 * {layoutKey, layoutMirror, seats: [...]}, not a bare array. These tests pin
 * the adapter that keeps the kiosk (and other pre-D4/D5) UIs from crashing
 * with `TypeError: seats.filter is not a function` when they store the raw
 * response and later call array methods on it.
 */
import { describe, expect, it } from "vitest";
import { adaptKioskSeats, extractSeatsArray, seatDisplayNumber } from "../adapt-seats";

const NEW_SHAPE = {
  layoutKey: "comb-75",
  layoutMirror: false,
  seats: [
    { id: "s1", label: "A-01", finger: 1, rowSide: "west", position: 1, status: "AVAILABLE", podType: "SINGLE", dualPartnerId: null },
    { id: "s2", label: "A-02", finger: 1, rowSide: "west", position: 2, status: "OCCUPIED", podType: "DUAL", dualPartnerId: "s3" },
    { id: "s3", label: "A-03", finger: 1, rowSide: "west", position: 3, status: "AVAILABLE", podType: "DUAL", dualPartnerId: "s2" },
  ],
};

describe("extractSeatsArray", () => {
  it("unwraps the new {seats: [...]} shape", () => {
    expect(extractSeatsArray(NEW_SHAPE)).toBe(NEW_SHAPE.seats);
  });

  it("passes a bare array through unchanged (pre-A8 shape / defensive)", () => {
    const bare = [{ id: "x" }];
    expect(extractSeatsArray(bare)).toBe(bare);
  });

  it("never throws on garbage input - returns []", () => {
    expect(extractSeatsArray(null)).toEqual([]);
    expect(extractSeatsArray(undefined)).toEqual([]);
    expect(extractSeatsArray("oops")).toEqual([]);
    expect(extractSeatsArray(42)).toEqual([]);
    expect(extractSeatsArray({})).toEqual([]);
    expect(extractSeatsArray({ seats: "not-an-array" })).toEqual([]);
  });
});

describe("seatDisplayNumber", () => {
  it("prefers label (comb seats)", () => {
    expect(seatDisplayNumber({ label: "B-07", number: "07" })).toBe("B-07");
  });

  it("falls back to number (legacy seats, no label)", () => {
    expect(seatDisplayNumber({ number: "07" })).toBe("07");
  });

  it("falls back to the given fallback when neither is present", () => {
    expect(seatDisplayNumber({}, "01")).toBe("01");
  });
});

describe("adaptKioskSeats (kiosk check-in / kiosk-order-flow)", () => {
  it("adapts the new {seats: [...]} shape into the legacy flat Seat[] the kiosk UI reads", () => {
    const seats = adaptKioskSeats(NEW_SHAPE);
    expect(seats).toHaveLength(3);
    expect(seats[0]).toEqual({
      id: "s1", number: "A-01", status: "AVAILABLE", podType: "SINGLE", row: 0, col: 0, side: "left", dualPartnerId: undefined,
    });
    expect(seats[1].dualPartnerId).toBe("s3");
  });

  it("every array method the kiosk pod-selection screens call works without throwing", () => {
    const seats = adaptKioskSeats(NEW_SHAPE);
    // The exact operations from kiosk/check-in/page.tsx and kiosk-order-flow.tsx.
    expect(() => seats.filter((s) => s.side === "left")).not.toThrow();
    expect(() => seats.find((s) => s.id === "s1")).not.toThrow();
    expect(() => seats.some((s) => s.dualPartnerId === "s2")).not.toThrow();
    expect(seats.find((s) => s.id === "s1")?.number).toBe("A-01");
  });

  it("is a no-op-safe no-crash path for a bare array (old shape) too", () => {
    const seats = adaptKioskSeats([{ id: "legacy1", number: "01", status: "AVAILABLE", podType: "SINGLE", row: 0, col: 0, side: "left" }]);
    expect(seats).toHaveLength(1);
    expect(seats[0].number).toBe("01");
  });

  it("never throws on a garbage/failed response", () => {
    expect(adaptKioskSeats(null)).toEqual([]);
    expect(adaptKioskSeats(undefined)).toEqual([]);
    expect(adaptKioskSeats({})).toEqual([]);
  });
});
