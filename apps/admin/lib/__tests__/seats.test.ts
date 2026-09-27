import { describe, expect, test } from "vitest";
import { canLinkDual, dualPodCount, partnerNumber, selectionLabel, singlePodCount, sortByNumber, toggleSelection, type Seat } from "../seats";

const seat = (over: Partial<Seat>): Seat => ({ id: over.id ?? "1", number: "01", status: "AVAILABLE", podType: "SINGLE", dualPartnerId: null, ...over });

describe("sortByNumber", () => {
  test("sorts numerically, not lexically", () => {
    const seats = [seat({ id: "a", number: "10" }), seat({ id: "b", number: "02" }), seat({ id: "c", number: "1" })];
    expect(sortByNumber(seats).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});

describe("dualPodCount / singlePodCount", () => {
  test("counts a dual pair as one, and excludes linked singles", () => {
    const seats = [
      seat({ id: "1", podType: "DUAL", dualPartnerId: "2" }),
      seat({ id: "2", podType: "DUAL", dualPartnerId: "1" }),
      seat({ id: "3", podType: "SINGLE" }),
      seat({ id: "4", podType: "SINGLE" }),
    ];
    expect(dualPodCount(seats)).toBe(1);
    expect(singlePodCount(seats)).toBe(2);
  });
});

describe("partnerNumber", () => {
  test("resolves the linked pod's number", () => {
    const seats = [seat({ id: "1", number: "01", podType: "DUAL", dualPartnerId: "2" }), seat({ id: "2", number: "02", podType: "DUAL", dualPartnerId: "1" })];
    expect(partnerNumber(seats, seats[0])).toBe("02");
  });
  test("null for a single pod", () => {
    expect(partnerNumber([seat({ id: "1" })], seat({ id: "1" }))).toBeNull();
  });
});

describe("toggleSelection", () => {
  test("selects, then a second, then a third replaces the oldest", () => {
    let sel = toggleSelection([], "a");
    expect(sel).toEqual(["a"]);
    sel = toggleSelection(sel, "b");
    expect(sel).toEqual(["a", "b"]);
    sel = toggleSelection(sel, "c");
    expect(sel).toEqual(["b", "c"]);
  });
  test("tapping a selected pod deselects it", () => {
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("canLinkDual", () => {
  const seats = [seat({ id: "1" }), seat({ id: "2" }), seat({ id: "3", dualPartnerId: "4" })];
  test("needs exactly 2 selections", () => {
    expect(canLinkDual(seats, ["1"])).toEqual({ ok: false, reason: "Select exactly 2 pods." });
  });
  test("errors when either pod is already linked", () => {
    expect(canLinkDual(seats, ["1", "3"])).toMatchObject({ ok: false });
  });
  test("ok for two unlinked pods", () => {
    expect(canLinkDual(seats, ["1", "2"])).toEqual({ ok: true });
  });
});

describe("selectionLabel", () => {
  test("names both selected pods", () => {
    const seats = [seat({ id: "1", number: "03" }), seat({ id: "2", number: "07" })];
    expect(selectionLabel(seats, ["1", "2"])).toBe("Selected: Pods 03 and 07");
  });
  test("empty when nothing is selected", () => {
    expect(selectionLabel([], [])).toBe("");
  });
});
