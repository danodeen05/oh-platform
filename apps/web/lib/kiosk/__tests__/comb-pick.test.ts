// @vitest-environment jsdom
/**
 * Task D12: the kiosk picks a pod on the comb map by its label, and the order
 * PATCH carries that pod's seat id.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { buildLayout, LOCATION_LAYOUTS } from "@oh/floor-plan";
import en from "../../../messages/en.json";
import type { CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { KioskCombPickerView } from "@/components/kiosk/KioskCombPicker";
import { kioskCombFrom, podNames, podPatchBody, podPick, seatsForPick } from "../comb-pick";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = (en as unknown as { combMap: CombMapLabels }).combMap;

/** A GET /locations/:id/seats body for City Creek: every pod free, ids "seat-<label>". */
function seatsResponse(overrides: Record<string, string> = {}) {
  const layout = buildLayout(LOCATION_LAYOUTS["comb-75"]);
  const idOf = (n: number) => `seat-${layout.pods.find((p) => p.number === n)?.label}`;
  return {
    layoutKey: "comb-75",
    layoutMirror: false,
    seats: layout.pods.map((p) => ({
      id: `seat-${p.label}`,
      label: p.label,
      status: overrides[p.label] ?? "AVAILABLE",
      podType: p.type === "duo" ? "DUAL" : "SINGLE",
      dualPartnerId: p.duoWith ? idOf(p.duoWith) : null,
    })),
  };
}

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
function mount(props: Parameters<typeof KioskCombPickerView>[0]) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(KioskCombPickerView, props)));
  return host;
}
const tap = (h: HTMLElement, label: string) =>
  act(() => (h.querySelector(`[data-label="${label}"]`) as SVGGElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("kiosk comb picker", () => {
  it("tapping B-07 selects that pod's seat id, and the order PATCH sends it", () => {
    const comb = kioskCombFrom(seatsResponse());
    expect(comb.layoutKey).toBe("comb-75");
    const onSelectPod = vi.fn();
    const h = mount({ layoutKey: "comb-75", seats: comb.seats, canSelectDualPod: false, onSelectPod, onDualBlocked: vi.fn(), labels });
    expect(h.querySelector("svg[data-layout]")?.getAttribute("data-orientation")).toBe("landscape");
    tap(h, "B-07");
    expect(onSelectPod).toHaveBeenCalledWith("seat-B-07");

    const body = podPatchBody({ selectedPodId: onSelectPod.mock.calls[0][0], podAutoAssigned: false }, new Date("2026-10-01T18:00:00Z"));
    expect(body).toEqual({
      seatId: "seat-B-07",
      podSelectionMethod: "CUSTOMER_SELECTED",
      podAssignedAt: "2026-10-01T18:00:00.000Z",
      podReservationExpiry: "2026-10-01T18:15:00.000Z",
    });
    expect(podNames(comb.seats, "seat-B-07")).toEqual({ label: "B-07", duo: false });
  });

  it("tapping the selected pod clears it; an occupied pod does nothing", () => {
    const comb = kioskCombFrom(seatsResponse({ "A-03": "OCCUPIED" }));
    const onSelectPod = vi.fn();
    const h = mount({ layoutKey: "comb-75", seats: comb.seats, selectedPodId: "seat-B-07", canSelectDualPod: false, onSelectPod, onDualBlocked: vi.fn(), labels });
    tap(h, "B-07");
    tap(h, "A-03");
    expect(onSelectPod.mock.calls).toEqual([[""]]);
  });

  it("a pod another guest in the party took reads as reserved and can't be picked", () => {
    const comb = kioskCombFrom(seatsResponse());
    const shown = seatsForPick(comb.seats, ["seat-B-07", "auto"], null);
    expect(shown.find((s) => s.label === "B-07")?.status).toBe("RESERVED");
    expect(podPick(shown, "B-07", { canSelectDual: false })).toEqual({ kind: "none" });
  });

  it("a duo when the party can't take one opens the dual-pod rules instead", () => {
    const comb = kioskCombFrom(seatsResponse());
    const duo = comb.seats.find((s) => s.podType === "DUAL" && s.dualPartnerLabel)!;
    expect(podPick(comb.seats, duo.label, { canSelectDual: false })).toEqual({ kind: "dual-blocked" });
    expect(podPick(comb.seats, duo.label, { canSelectDual: true })).toEqual({ kind: "select", id: duo.id });
    // Tapping the partner of the selected duo clears the pair.
    expect(podPick(comb.seats, duo.dualPartnerLabel!, { selectedId: duo.id, canSelectDual: true })).toEqual({ kind: "clear" });
    expect(podNames(comb.seats, duo.id)?.duo).toBe(true);
  });

  it("an auto pick or no pick sends no PATCH; a legacy array response has no layout", () => {
    expect(podPatchBody({ selectedPodId: "auto" })).toBeNull();
    expect(podPatchBody({})).toBeNull();
    expect(kioskCombFrom([{ id: "s1", number: "01" }])).toEqual({ layoutKey: null, seats: [] });
  });
});
