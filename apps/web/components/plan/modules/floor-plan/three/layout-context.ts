import { createContext, useContext } from "react";
import { BUILDING, DIMS, buildLayout, type Layout, type Rect } from "../layout";
import type { IsoPreset } from "./types";

/**
 * Which comb layout the 3D scene draws (Task D4). The business plan passes
 * nothing and gets its own layout (`buildLayout()`, the same module-level
 * objects `../layout` re-exports, so the plan scene is unchanged); the
 * customer location pages pass City Creek's 75 pods or University Place's
 * 70, mirrored. The provider sits inside the <Canvas>, so every scene part
 * reads it with `useSceneLayout()`.
 */
export const PLAN_LAYOUT: Layout = buildLayout();

export const SceneLayoutContext = createContext<Layout>(PLAN_LAYOUT);

export function useSceneLayout(): Layout {
  return useContext(SceneLayoutContext);
}

/** A fixture drawn at unmirrored coordinates, flipped across the building for a mirrored layout. */
export function mirrorRect<R extends Rect>(layout: Layout, r: R): R {
  return layout.options.mirror ? { ...r, x: BUILDING.w - r.x - r.w } : r;
}

export interface PresetView {
  x: number;
  z: number;
  /** How many feet of plan fit across the viewport. */
  viewFt: number;
}

/** The camera presets for a layout. For the plan layout these are exactly the original values. */
export function presetViews(layout: Layout): Record<IsoPreset, PresetView> {
  const lobby = layout.zones.find((z) => z.key === "lobby")!;
  const finger2 = layout.fingers[1]!;
  const kitchenX = layout.options.mirror ? BUILDING.w - DIMS.kitchenW / 2 : DIMS.kitchenW / 2;
  return {
    overview: { x: BUILDING.w / 2 + 4, z: BUILDING.h / 2 - 2, viewFt: 122 },
    kitchen: { x: kitchenX, z: DIMS.rear / 2 + 3, viewFt: 62 },
    finger: { x: finger2.x + finger2.w / 2, z: finger2.y + finger2.h / 2, viewFt: 42 },
    lobby: { x: lobby.x + lobby.w / 2, z: lobby.y + lobby.h / 2, viewFt: 38 },
  };
}
