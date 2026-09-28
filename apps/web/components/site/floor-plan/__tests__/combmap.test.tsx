// @vitest-environment jsdom
/**
 * Task D4a: the CombMap floor-plan component (component half of Task D4).
 *
 * Markup assertions use `renderToString`; interaction (onSelect, keyboard)
 * uses a real React root on jsdom. jsdom has no layout, so the map never
 * learns its on-screen size here: a tap on a pod selects it directly (the
 * "too small, zoom first" rule needs a measured size, and is covered by the
 * pure `podTapAction` and `rowZoomBox` tests below).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { buildLayout, LOCATION_LAYOUTS } from "@oh/floor-plan";
import en from "../../../../messages/en.json";
import es from "../../../../messages/es.json";
import zhCN from "../../../../messages/zh-CN.json";
import zhTW from "../../../../messages/zh-TW.json";
import { CombMap, coarseFor, orientLayout, podTapAction, podScreenPx, type CombSeat, type CombMapLabels } from "../CombMap";
import { rowZoomBox, rowPanBox, rowPanState, minTargetPx, zoomDuration, fitBox, ZOOM_MS, MIN_TOUCH_PX } from "../RowZoom";
import { toCombSeats, layoutKeyOf } from "../useSeats";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stepProgress } from "@/lib/site/experience-progress";

// React 19 act() environment flag for a hand-rolled root.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = (en as unknown as { combMap: CombMapLabels }).combMap;

type LayoutKey = "comb-75" | "comb-70-mirrored";
const layoutOf = (key: LayoutKey) => buildLayout(LOCATION_LAYOUTS[key]);

/** Every pod available, except a few with each other status. */
function seatsFor(key: LayoutKey, overrides: Record<string, CombSeat["status"]> = {}): CombSeat[] {
  const layout = layoutOf(key);
  return layout.pods.map((p) => ({
    label: p.label,
    status: overrides[p.label] ?? "AVAILABLE",
    podType: p.type === "duo" ? "DUAL" : "SINGLE",
    dualPartnerLabel: p.duoWith ? layout.pods.find((q) => q.number === p.duoWith)?.label : undefined,
  }));
}

const count = (html: string, needle: RegExp) => (html.match(needle) ?? []).length;

function attrOf(html: string, tagMatcher: RegExp, attr: string): number {
  const tag = html.match(tagMatcher)?.[0];
  if (!tag) throw new Error(`no tag matching ${tagMatcher}`);
  const v = tag.match(new RegExp(`\\s${attr}="([^"]+)"`))?.[1];
  if (v === undefined) throw new Error(`no ${attr} on ${tag}`);
  return Number(v);
}

describe("CombMap markup", () => {
  it("renders 70 pods for comb-70-mirrored and 75 for comb-75, in both orientations", () => {
    for (const orientation of ["portrait", "landscape"] as const) {
      const seventy = renderToString(<CombMap layoutKey="comb-70-mirrored" mode="live" labels={labels} orientation={orientation} />);
      const seventyFive = renderToString(<CombMap layoutKey="comb-75" mode="live" labels={labels} orientation={orientation} />);
      expect(count(seventy, /data-pod="/g)).toBe(70);
      expect(count(seventyFive, /data-pod="/g)).toBe(75);
    }
  });

  it("puts the lobby left of x=35 when mirrored and at 35 or more when not (landscape, feet)", () => {
    const mirrored = renderToString(<CombMap layoutKey="comb-70-mirrored" mode="live" labels={labels} orientation="landscape" />);
    const plain = renderToString(<CombMap layoutKey="comb-75" mode="live" labels={labels} orientation="landscape" />);
    const lobby = /<rect[^>]*data-zone="lobby"[^>]*>/;
    expect(attrOf(mirrored, lobby, "x")).toBeLessThan(35);
    expect(attrOf(plain, lobby, "x")).toBeGreaterThanOrEqual(35);
  });

  it("portrait swaps the axes in data: the long side runs vertically and the lobby lands at the bottom for both locations", () => {
    for (const key of ["comb-75", "comb-70-mirrored"] as const) {
      const html = renderToString(<CombMap layoutKey={key} mode="live" labels={labels} orientation="portrait" />);
      const vb = html.match(/<svg[^>]*viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
      expect(vb).toBeDefined();
      const [, , w, h] = vb as number[];
      expect(h as number).toBeGreaterThan(w as number);
      const lobby = /<rect[^>]*data-zone="lobby"[^>]*>/;
      expect(attrOf(html, lobby, "y")).toBeGreaterThanOrEqual(50);
    }
  });

  it("never flips or rotates anything with a transform, so labels always read left to right", () => {
    for (const key of ["comb-75", "comb-70-mirrored"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const html = renderToString(<CombMap layoutKey={key} mode="pick" labels={labels} orientation={orientation} seats={seatsFor(key)} />);
        expect(html).not.toContain("scale(-1");
        expect(html).not.toMatch(/rotate\(/);
      }
    }
  });

  it("orientLayout keeps pod geometry consistent: portrait pods are the landscape pods with width and height swapped", () => {
    const layout = layoutOf("comb-75");
    const land = orientLayout(layout, "landscape");
    const port = orientLayout(layout, "portrait");
    expect(port.pods).toHaveLength(land.pods.length);
    for (let i = 0; i < land.pods.length; i += 1) {
      expect(port.pods[i]!.rect.w).toBeCloseTo(land.pods[i]!.rect.h);
      expect(port.pods[i]!.rect.h).toBeCloseTo(land.pods[i]!.rect.w);
    }
    expect(port.box.w).toBeCloseTo(land.box.h);
  });

  it("shows status by fill plus pattern: a diagonal hatch for reserved, dots for cleaning", () => {
    const seats = seatsFor("comb-75", { "A-01": "RESERVED", "A-04": "OCCUPIED", "B-07": "CLEANING" });
    const html = renderToString(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seats} orientation="landscape" />);
    expect(html).toContain("<pattern");
    const reservedId = html.match(/<pattern[^>]*id="([^"]*reserved[^"]*)"/)?.[1];
    const cleaningId = html.match(/<pattern[^>]*id="([^"]*cleaning[^"]*)"/)?.[1];
    expect(reservedId).toBeTruthy();
    expect(cleaningId).toBeTruthy();
    const pod = (label: string) => html.match(new RegExp(`<g[^>]*data-label="${label}"[^>]*>[\\s\\S]*?</g>`))?.[0] ?? "";
    expect(pod("A-01")).toContain(`url(#${reservedId})`);
    expect(pod("B-07")).toContain(`url(#${cleaningId})`);
    expect(pod("A-04")).not.toContain("url(#");
    expect(pod("A-02")).not.toContain("url(#");
    expect(pod("A-01")).toContain('data-status="RESERVED"');
    expect(pod("A-04")).toContain('data-status="OCCUPIED"');
  });

  it("makes every pod a named button in pick mode, with one roving tab stop", () => {
    const seats = seatsFor("comb-75", { "C-03": "OCCUPIED" });
    const html = renderToString(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seats} />);
    expect(count(html, /role="button"[^>]*data-pod=|data-pod="[^"]*"[^>]*role="button"/g)).toBe(75);
    expect(html).toContain('aria-label="Pod B-07, available"');
    expect(html).toContain('aria-label="Pod C-03, occupied"');
    expect(count(html, /data-pod="[^"]*"[^>]*tabindex="0"|tabindex="0"[^>]*data-pod="/g)).toBe(1);
  });

  it("marks the selected pod pressed", () => {
    const html = renderToString(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seatsFor("comb-75")} selected="B-07" />);
    const tag = html.match(/<g[^>]*data-label="B-07"[^>]*>/)?.[0] ?? "";
    expect(tag).toContain('aria-pressed="true"');
    expect(tag).toContain('tabindex="0"');
  });

  it("highlights available duo pairs when the party is 2, and not for a party of 1", () => {
    const layout = layoutOf("comb-75");
    const duoLabels = layout.pods.filter((p) => p.type === "duo").map((p) => p.label);
    expect(duoLabels.length).toBe(10);
    // Reserve one half of the first pair: that pair is no longer a free duo.
    const [firstA] = duoLabels;
    const seats = seatsFor("comb-75", { [firstA as string]: "RESERVED" });
    const party2 = renderToString(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seats} partySize={2} />);
    const party1 = renderToString(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seats} partySize={1} />);
    expect(count(party2, /data-duo-highlight="true"/g)).toBe(8);
    expect(count(party1, /data-duo-highlight="true"/g)).toBe(0);
    expect(party2).toContain("data-duo-pair=");
  });

  it("journey mode plots the guest and the bowl along the layout's paths and moves them with journeyProgress", () => {
    const at = (p: number) => renderToString(<CombMap layoutKey="comb-70-mirrored" mode="journey" labels={labels} journeyProgress={p} orientation="landscape" />);
    const start = at(0.1);
    const mid = at(0.7);
    const pos = (html: string, who: string) => {
      const tag = html.match(new RegExp(`<circle[^>]*data-marker="${who}"[^>]*>`))?.[0] ?? "";
      return [Number(tag.match(/\scx="([^"]+)"/)?.[1]), Number(tag.match(/\scy="([^"]+)"/)?.[1])];
    };
    const layout = layoutOf("comb-70-mirrored");
    const g = layout.journeyMarkers(0.7).guest!;
    const [gx, gy] = pos(mid, "guest");
    expect(gx).toBeCloseTo(g[0], 3);
    expect(gy).toBeCloseTo(g[1], 3);
    expect(pos(start, "guest")).not.toEqual(pos(mid, "guest"));
    expect(pos(mid, "bowl")[0]).not.toBeNaN();
    // Decorative animation: no pod buttons, one labelled image.
    expect(mid).not.toMatch(/data-pod="[^"]*"[^>]*role="button"/);
    expect(mid).toMatch(/<svg[^>]*role="img"/);
    expect(mid).toContain(`data-journey-target="${layout.journeyTarget.label}"`);
  });
});

// Task G2b (D2 review): no bowl before the guest has ordered. Since the
// 2026-09-28 follow-up (eight steps) the experience map shows it from the
// status step: the kitchen fires a bowl once its guest checks in, when the
// phone goes to PREPPING.
describe("CombMap journey: the bowl appears from bowlFrom (the status step on the experience page)", () => {
  it("hides the bowl marker before bowlFrom and shows it from there", () => {
    const layout = layoutOf("comb-75");
    const steps = stepProgress(layout);
    const at = (p: number, from: number) =>
      renderToString(<CombMap layoutKey="comb-75" mode="journey" labels={labels} journeyProgress={p} bowlFrom={from} orientation="landscape" />);
    expect(at(steps.arrive, steps.order)).not.toContain('data-marker="bowl"');
    expect(at(steps.arrive, steps.order)).toContain('data-marker="guest"');
    expect(at(steps.order, steps.order)).toContain('data-marker="bowl"');
    // The experience page: nothing before check-in, the bowl from status to taste.
    expect(at(steps.order, steps.status)).not.toContain('data-marker="bowl"');
    expect(at(steps.settle, steps.status)).not.toContain('data-marker="bowl"');
    expect(at(steps.status, steps.status)).toContain('data-marker="bowl"');
    expect(at(steps.panel, steps.status)).toContain('data-marker="bowl"');
  });

  it("the experience page's map passes the status step as bowlFrom", () => {
    const src = readFileSync(path.resolve(__dirname, "../../experience/JourneyMap.tsx"), "utf8");
    expect(src).toMatch(/mode="journey"[^>]*bowlFrom=\{progress\.status\}/);
  });
});

describe("CombMap interaction (jsdom)", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });
  function mount(ui: React.ReactElement) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(ui));
    return host;
  }
  const podEl = (h: HTMLElement, label: string) => h.querySelector(`[data-label="${label}"]`) as SVGGElement;

  it("fires onSelect with the pod label when an available pod is tapped", () => {
    const onSelect = vi.fn();
    const h = mount(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seatsFor("comb-75")} onSelect={onSelect} />);
    act(() => podEl(h, "B-07").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith("B-07");
  });

  it("fires onSelect from the keyboard (Enter and Space)", () => {
    const onSelect = vi.fn();
    const h = mount(<CombMap layoutKey="comb-70-mirrored" mode="pick" labels={labels} seats={seatsFor("comb-70-mirrored")} onSelect={onSelect} />);
    act(() => podEl(h, "C-05").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    act(() => podEl(h, "A-02").dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(onSelect.mock.calls).toEqual([["C-05"], ["A-02"]]);
  });

  it("does not select an unavailable pod, and marks it aria-disabled", () => {
    const onSelect = vi.fn();
    const h = mount(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seatsFor("comb-75", { "B-07": "OCCUPIED" })} onSelect={onSelect} />);
    const el = podEl(h, "B-07");
    expect(el.getAttribute("aria-disabled")).toBe("true");
    act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("moves focus between pods with the arrow keys (roving tab stop)", () => {
    const h = mount(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seatsFor("comb-75")} orientation="landscape" selected="B-07" />);
    const start = podEl(h, "B-07");
    act(() => start.focus());
    // Landscape: rows run down the page from the kitchen, so ArrowDown is the next position.
    act(() => start.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect((document.activeElement as Element | null)?.getAttribute("data-label")).toBe("B-08");
    expect(podEl(h, "B-08").getAttribute("tabindex")).toBe("0");
    expect(podEl(h, "B-07").getAttribute("tabindex")).toBe("-1");
    act(() => podEl(h, "B-08").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })));
    expect((document.activeElement as Element | null)?.getAttribute("data-label")).toBe("B-07");
  });

  it("hybrid device: decides coarse or fine per interaction (touch zooms first, then a mouse selects a ~35px pod directly, then touch zooms again)", () => {
    // A touchscreen laptop: the primary pointer is fine, the map is 1100px wide in landscape (pods ~35px on the short side).
    const g = globalThis as unknown as { ResizeObserver?: unknown };
    const savedRO = g.ResizeObserver;
    const savedMM = window.matchMedia;
    g.ResizeObserver = class {
      cb: (e: { contentRect: { width: number } }[]) => void;
      constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
        this.cb = cb;
      }
      observe() {
        this.cb([{ contentRect: { width: 1100 } }]);
      }
      disconnect() {}
    };
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduced-motion"), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const pointer = (el: Element, type: string, pointerType: string) => {
      const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 });
      Object.defineProperty(e, "pointerType", { value: pointerType });
      Object.defineProperty(e, "pointerId", { value: pointerType === "mouse" ? 1 : 2 });
      el.dispatchEvent(e);
    };
    const tap = (el: Element, pointerType: "touch" | "mouse" | "pen") =>
      act(() => {
        pointer(el, "pointerdown", pointerType);
        pointer(el, "pointerup", pointerType);
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    try {
      const onSelect = vi.fn();
      const h = mount(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seatsFor("comb-75")} onSelect={onSelect} orientation="landscape" />);
      const svg = h.querySelector("svg[data-layout]") as SVGSVGElement;
      const vbW = () => Number(svg.getAttribute("viewBox")!.split(" ")[2]);
      const fullW = vbW();
      const wholeFloor = () => [...h.querySelectorAll("button")].find((b) => b.textContent === labels.zoom.wholeFloor) as HTMLButtonElement;

      // 1. Touch: ~35px is under 44, so it zooms first.
      tap(podEl(h, "B-07"), "touch");
      expect(onSelect).not.toHaveBeenCalled();
      expect(vbW()).toBeLessThan(fullW);
      act(() => wholeFloor().click());
      expect(vbW()).toBeCloseTo(fullW);

      // 2. Mouse on the same device: ~35px clears 24, so it selects directly (no sticky touch mode).
      tap(podEl(h, "B-07"), "mouse");
      expect(onSelect).toHaveBeenCalledWith("B-07");
      expect(vbW()).toBeCloseTo(fullW);

      // 3. Touch again: back to zoom first.
      tap(podEl(h, "B-08"), "touch");
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(vbW()).toBeLessThan(fullW);
      act(() => wholeFloor().click());

      // Pen counts as coarse too; the keyboard stays exempt and always selects.
      tap(podEl(h, "B-09"), "pen");
      expect(onSelect).toHaveBeenCalledTimes(1);
      act(() => podEl(h, "B-10").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
      expect(onSelect).toHaveBeenLastCalledWith("B-10");
    } finally {
      g.ResizeObserver = savedRO;
      window.matchMedia = savedMM;
    }
  });

  it("coarseFor: the event's pointer type wins; the media query is only the default before any pointer event", () => {
    expect(coarseFor({ pointerType: "touch", mediaCoarse: false })).toBe(true);
    expect(coarseFor({ pointerType: "pen", mediaCoarse: false })).toBe(true);
    expect(coarseFor({ pointerType: "mouse", mediaCoarse: true })).toBe(false);
    expect(coarseFor({ pointerType: null, mediaCoarse: true })).toBe(true);
    expect(coarseFor({ pointerType: null, mediaCoarse: false })).toBe(false);
  });

  it("on a 390px phone, a tap zooms to part of the row and the named pan chevrons walk to both ends", () => {
    // jsdom has no layout: report a 358px-wide map (390 minus gutters) and prefer reduced motion so zooms land instantly.
    const g = globalThis as unknown as { ResizeObserver?: unknown; matchMedia?: unknown };
    const savedRO = g.ResizeObserver;
    const savedMM = window.matchMedia;
    g.ResizeObserver = class {
      cb: (e: { contentRect: { width: number } }[]) => void;
      constructor(cb: (e: { contentRect: { width: number } }[]) => void) {
        this.cb = cb;
      }
      observe() {
        this.cb([{ contentRect: { width: 358 } }]);
      }
      disconnect() {}
    };
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduced-motion") || q.includes("pointer: coarse"), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      const onSelect = vi.fn();
      const h = mount(<CombMap layoutKey="comb-75" mode="pick" labels={labels} seats={seatsFor("comb-75")} onSelect={onSelect} orientation="portrait" />);
      const svg = h.querySelector("svg[data-layout]") as SVGSVGElement;
      const vb = () => svg.getAttribute("viewBox")!.split(" ").map(Number) as [number, number, number, number];
      const fullW = vb()[2];

      // First tap: pods are too small, so it zooms instead of selecting.
      act(() => podEl(h, "B-07").dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(onSelect).not.toHaveBeenCalled();
      const [, , w] = vb();
      expect(w).toBeLessThan(fullW);
      expect(Math.min(2.35, 4.5) * (358 / w)).toBeGreaterThanOrEqual(44);

      const earlier = h.querySelector(`button[aria-label="${labels.pan.earlier}"]`) as HTMLButtonElement;
      const later = h.querySelector(`button[aria-label="${labels.pan.later}"]`) as HTMLButtonElement;
      expect(earlier).toBeTruthy();
      expect(later).toBeTruthy();

      // Walk to each end: the chevron disables once that end pod is fully in view.
      for (const btn of [earlier, later]) {
        let n = 0;
        while (!btn.disabled && n < 20) {
          act(() => btn.click());
          n += 1;
        }
        expect(btn.disabled).toBe(true);
      }
      expect(vb()[2]).toBeCloseTo(w); // panning never changes the zoom

      // Second tap, now at 44px or more: it selects.
      act(() => podEl(h, "B-07").dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(onSelect).toHaveBeenCalledWith("B-07");
    } finally {
      g.ResizeObserver = savedRO;
      window.matchMedia = savedMM;
    }
  });
});

describe("RowZoom", () => {
  it("animates over 350 ms, or instantly with reduced motion", () => {
    expect(ZOOM_MS).toBe(350);
    expect(zoomDuration(false)).toBe(350);
    expect(zoomDuration(true)).toBe(0);
  });

  it("fitBox keeps the container aspect and contains the target", () => {
    const box = fitBox({ x: 10, y: 10, w: 4, h: 30 }, 50 / 70);
    expect(box.w / box.h).toBeCloseTo(50 / 70);
    expect(box.x).toBeLessThanOrEqual(10);
    expect(box.x + box.w).toBeGreaterThanOrEqual(14);
    expect(box.y).toBeLessThanOrEqual(10);
    expect(box.y + box.h).toBeGreaterThanOrEqual(40);
  });

  /** Pods whose rect overlaps the viewBox, with their on-screen width and height in CSS px (element width / viewBox width). */
  function visiblePodPx(o: ReturnType<typeof orientLayout>, vb: { x: number; y: number; w: number; h: number }, elementPx: number) {
    const pxPerFt = elementPx / vb.w;
    return o.pods
      .filter((p) => p.rect.x < vb.x + vb.w && p.rect.x + p.rect.w > vb.x && p.rect.y < vb.y + vb.h && p.rect.y + p.rect.h > vb.y)
      .map((p) => ({ label: p.label, w: p.rect.w * pxPerFt, h: p.rect.h * pxPerFt }));
  }

  it("after zooming row B on a 390x844 portrait comb-75, every visible pod is at least 44px wide AND tall", () => {
    expect(MIN_TOUCH_PX).toBe(44);
    const elementPx = 390 - 32; // 16px gutters
    const o = orientLayout(layoutOf("comb-75"), "portrait");
    const b07 = o.pods.find((p) => p.label === "B-07")!;
    const row = o.rows.find((r) => r.key === b07.row)!;
    const vb = rowZoomBox(row.rect, o.box, elementPx, b07.center);
    const visible = visiblePodPx(o, vb, elementPx);
    expect(visible.map((p) => p.label)).toContain("B-07");
    for (const p of visible) {
      expect(p.w, `${p.label} width`).toBeGreaterThanOrEqual(44);
      expect(p.h, `${p.label} height`).toBeGreaterThanOrEqual(44);
    }
  });

  it("every row of both layouts, zoomed on any of its pods, keeps min(width, height) >= 44px at 390 (portrait) and 1440 (landscape)", () => {
    for (const key of ["comb-75", "comb-70-mirrored"] as const) {
      for (const [orientation, elementPx] of [["portrait", 390 - 32], ["landscape", 1440 - 64]] as const) {
        const o = orientLayout(layoutOf(key), orientation);
        for (const pod of o.pods) {
          const row = o.rows.find((r) => r.key === pod.row)!;
          const vb = rowZoomBox(row.rect, o.box, elementPx, pod.center);
          expect(vb.w / vb.h).toBeCloseTo(o.box.w / o.box.h);
          const size = podScreenPx(elementPx / vb.w, orientation);
          expect(Math.min(size.w, size.h), `${key} ${orientation} ${pod.label}`).toBeGreaterThanOrEqual(44);
          // The tapped pod is fully in view.
          expect(pod.rect.x >= vb.x - 1e-6 && pod.rect.x + pod.rect.w <= vb.x + vb.w + 1e-6, `${pod.label} x in view`).toBe(true);
          expect(pod.rect.y >= vb.y - 1e-6 && pod.rect.y + pod.rect.h <= vb.y + vb.h + 1e-6, `${pod.label} y in view`).toBe(true);
        }
      }
    }
  });

  it("minTargetPx: 44px for coarse (touch) pointers, 24px (WCAG 2.2 AA) for fine (mouse) pointers", () => {
    expect(minTargetPx({ coarse: true })).toBe(44);
    expect(minTargetPx({ coarse: false })).toBe(24);
  });

  it("a coarse pointer at 390px zooms first; a fine pointer at 1440 selects a ~35px pod directly", () => {
    // Phone: the whole portrait map in a 358px element.
    const phone = orientLayout(layoutOf("comb-75"), "portrait");
    const phonePx = Math.min(...Object.values(podScreenPx(358 / phone.box.w, "portrait")));
    expect(phonePx).toBeLessThan(24);
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: phonePx, selectable: true, coarse: true })).toBe("zoom");
    // Desktop: landscape map in a 1100px column on a 1440 screen (the preview harness), pods about 35px on the short side.
    const desk = orientLayout(layoutOf("comb-75"), "landscape");
    const deskPx = Math.min(...Object.values(podScreenPx(1100 / desk.box.w, "landscape")));
    expect(deskPx).toBeGreaterThan(30);
    expect(deskPx).toBeLessThan(44);
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: deskPx, selectable: true, coarse: false })).toBe("select");
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: deskPx, selectable: true, coarse: true })).toBe("zoom");
  });

  it("a fine pointer's row zoom fits the whole row (24px rule), a coarse one tightens to a partial row (44px rule)", () => {
    const o = orientLayout(layoutOf("comb-75"), "portrait");
    const b07 = o.pods.find((p) => p.label === "B-07")!;
    const row = o.rows.find((r) => r.key === b07.row)!;
    const fine = rowZoomBox(row.rect, o.box, 358, b07.center, { coarse: false });
    const coarse = rowZoomBox(row.rect, o.box, 358, b07.center, { coarse: true });
    expect(fine.w).toBeGreaterThan(row.rect.w);
    expect(Math.min(...Object.values(podScreenPx(358 / fine.w, "portrait")))).toBeGreaterThanOrEqual(24);
    expect(coarse.w).toBeLessThan(row.rect.w);
    expect(Math.min(...Object.values(podScreenPx(358 / coarse.w, "portrait")))).toBeGreaterThanOrEqual(44);
  });

  it("measures pods on the right axes: portrait rows run across the screen (pod width 2.35 ft), landscape rows run down it", () => {
    const p = podScreenPx(10, "portrait");
    const l = podScreenPx(10, "landscape");
    expect(p.w).toBeCloseTo(23.5);
    expect(p.h).toBeCloseTo(45);
    expect(l.w).toBeCloseTo(45);
    expect(l.h).toBeCloseTo(23.5);
  });

  it("panning a partial row zoom reaches the first and the last pod of the row", () => {
    const elementPx = 390 - 32;
    for (const key of ["comb-75", "comb-70-mirrored"] as const) {
      const o = orientLayout(layoutOf(key), "portrait");
      for (const row of o.rows) {
        const pods = o.pods.filter((p) => p.row === row.key).sort((a, b) => a.pod.position - b.pod.position);
        const ends = { first: pods[0]!.rect, last: pods[pods.length - 1]!.rect };
        const mid = pods[Math.floor(pods.length / 2)]!;
        let vb = rowZoomBox(row.rect, o.box, elementPx, mid.center);
        // A partial row: the ends start out of view.
        expect(rowPanState(vb, ends).canEarlier || rowPanState(vb, ends).canLater).toBe(true);
        for (const dir of ["earlier", "later"] as const) {
          let guard = 0;
          while (rowPanState(vb, ends)[dir === "earlier" ? "canEarlier" : "canLater"] && guard < 20) {
            vb = rowPanBox(vb, ends, dir, o.box);
            guard += 1;
          }
          expect(guard, `${key} row ${row.key} ${dir} did not converge`).toBeLessThan(20);
          const end = dir === "earlier" ? ends.first : ends.last;
          expect(end.x >= vb.x - 1e-6 && end.x + end.w <= vb.x + vb.w + 1e-6 && end.y >= vb.y - 1e-6 && end.y + end.h <= vb.y + vb.h + 1e-6).toBe(true);
          // Panning never zooms: pods stay at 44px or more.
          expect(Math.min(...Object.values(podScreenPx(elementPx / vb.w, "portrait")))).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  it("a tap on a pod too small to hit zooms to its row first; a big enough pod selects; keyboard always selects", () => {
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: 20, selectable: true })).toBe("zoom");
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: 50, selectable: true })).toBe("select");
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: 0, selectable: true })).toBe("select"); // size unknown
    expect(podTapAction({ mode: "pick", via: "keyboard", podPx: 20, selectable: true })).toBe("select");
    expect(podTapAction({ mode: "pick", via: "pointer", podPx: 50, selectable: false })).toBe("none");
    expect(podTapAction({ mode: "live", via: "pointer", podPx: 50, selectable: true })).toBe("zoom");
    expect(podTapAction({ mode: "journey", via: "pointer", podPx: 50, selectable: true })).toBe("none");
  });
});

describe("useSeats adapters", () => {
  it("maps the API shape to CombMap seats, resolving the duo partner id to a label and dropping order data", () => {
    const seats = toCombSeats({
      layoutKey: "comb-75",
      layoutMirror: false,
      seats: [
        { id: "s1", label: "A-02", finger: 1, rowSide: "west", position: 2, status: "AVAILABLE", podType: "DUAL", dualPartnerId: "s2", bestRank: 9, orders: [{ id: "o1" }] },
        { id: "s2", label: "A-03", finger: 1, rowSide: "west", position: 3, status: "RESERVED", podType: "DUAL", dualPartnerId: "s1", bestRank: 10 },
        { id: "s3", label: "B-07", finger: 2, rowSide: "west", position: 7, status: "WEIRD", podType: "SINGLE", dualPartnerId: null, bestRank: 1 },
      ],
    });
    expect(seats).toEqual([
      { id: "s1", label: "A-02", status: "AVAILABLE", podType: "DUAL", dualPartnerLabel: "A-03", bestRank: 9 },
      { id: "s2", label: "A-03", status: "RESERVED", podType: "DUAL", dualPartnerLabel: "A-02", bestRank: 10 },
      { id: "s3", label: "B-07", status: "OCCUPIED", podType: "SINGLE", dualPartnerLabel: undefined, bestRank: 1 },
    ]);
  });

  it("accepts only the two known layout keys", () => {
    expect(layoutKeyOf({ layoutKey: "comb-75" })).toBe("comb-75");
    expect(layoutKeyOf({ layoutKey: "comb-70-mirrored" })).toBe("comb-70-mirrored");
    expect(layoutKeyOf({ layoutKey: "u-shape" })).toBeNull();
    expect(layoutKeyOf(null)).toBeNull();
  });
});

describe("combMap translations", () => {
  const all = { en, es, "zh-CN": zhCN, "zh-TW": zhTW } as Record<string, Record<string, unknown>>;
  const flat = (o: unknown, prefix = ""): Record<string, string> =>
    Object.entries(o as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v && typeof v === "object") Object.assign(acc, flat(v, `${prefix}${k}.`));
      else acc[`${prefix}${k}`] = String(v);
      return acc;
    }, {});

  it("has identical combMap key sets in all 4 locales, with no em dashes", () => {
    const enKeys = Object.keys(flat(all.en!.combMap)).sort();
    expect(enKeys.length).toBeGreaterThan(10);
    for (const [loc, msgs] of Object.entries(all)) {
      const f = flat(msgs.combMap);
      expect(Object.keys(f).sort(), loc).toEqual(enKeys);
      for (const [k, v] of Object.entries(f)) expect(v.includes("\u2014"), `${loc} combMap.${k}`).toBe(false);
    }
  });

  it("is really translated (not English copies) and keeps the {label}/{status} placeholders", () => {
    const enFlat = flat(all.en!.combMap);
    for (const loc of ["es", "zh-CN", "zh-TW"]) {
      const f = flat(all[loc]!.combMap);
      const same = Object.keys(enFlat).filter((k) => f[k] === enFlat[k]);
      expect(same, `${loc} untranslated`).toEqual([]);
      for (const [k, v] of Object.entries(enFlat)) {
        for (const ph of v.match(/\{\w+\}/g) ?? []) expect(f[k], `${loc} combMap.${k} lost ${ph}`).toContain(ph);
      }
    }
  });
});

describe("live mode: your pod (Task D6, the pod page)", () => {
  it("highlights the selected pod and adds 'Your pod' to the key", () => {
    const html = renderToString(<CombMap layoutKey="comb-75" mode="live" labels={labels} seats={seatsFor("comb-75", { "B-07": "RESERVED" })} selected="B-07" orientation="portrait" />);
    expect(html).toMatch(/data-pod="B-07"[^>]*data-selected="true"/);
    expect(count(html, /data-selected="true"/g)).toBe(1);
    expect(html).toContain(labels.legend.selected);
  });

  it("without a selection, a live map marks nothing and keeps its usual key", () => {
    const html = renderToString(<CombMap layoutKey="comb-75" mode="live" labels={labels} seats={seatsFor("comb-75")} orientation="portrait" />);
    expect(count(html, /data-selected="true"/g)).toBe(0);
    expect(html).not.toContain(labels.legend.selected);
  });
});
