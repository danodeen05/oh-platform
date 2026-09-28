import { useEffect, useMemo, useRef, type ComponentRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "@react-three/drei";
import { OrthographicCamera, Vector3 } from "three";
import { presetViews, PLAN_LAYOUT, useSceneLayout, type PresetView } from "./layout-context";
import type { IsoPreset } from "./types";

/** drei's controls instance type, without depending on three-stdlib directly. */
export type Controls = ComponentRef<typeof OrbitControls>;

/** True isometric: 45° azimuth, atan(1/√2) elevation. */
export const ISO_EL = Math.atan(1 / Math.SQRT2);
export const ISO_AZ = Math.PI / 4;
const DIST = 200;

export function isoOffset(az = ISO_AZ, el = ISO_EL, dist = DIST): Vector3 {
  return new Vector3(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
}

export type { PresetView };
/** The plan layout's presets (kept for existing imports). */
export const PRESET_VIEWS: Record<IsoPreset, PresetView> = presetViews(PLAN_LAYOUT);

/**
 * Frames a preset: the orbit target and the orthographic zoom (pixels per
 * foot). Eases there unless motion is reduced, in which case it snaps.
 */
export function useIsoCamera(preset: IsoPreset, reduce: boolean, controls: RefObject<Controls | null>): void {
  const { camera, size, invalidate } = useThree();
  const layout = useSceneLayout();
  const views = useMemo(() => (layout === PLAN_LAYOUT ? PRESET_VIEWS : presetViews(layout)), [layout]);
  const goal = useRef<{ target: Vector3; zoom: number }>({ target: new Vector3(), zoom: 8 });
  const settled = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const v = views[preset];
    goal.current = { target: new Vector3(v.x, 0, v.z), zoom: size.width / v.viewFt };
    // First frame and reduced motion: snap. Otherwise the frame loop eases there.
    if (reduce || first.current) {
      const c = controls.current;
      const cam = camera as OrthographicCamera;
      if (c) c.target.copy(goal.current.target);
      cam.position.copy(goal.current.target).add(isoOffset());
      cam.zoom = goal.current.zoom;
      cam.updateProjectionMatrix();
      c?.update();
      first.current = false;
      settled.current = true;
    } else {
      settled.current = false;
    }
    invalidate();
  }, [preset, views, size.width, reduce, camera, controls, invalidate]);

  useFrame((_, dt) => {
    if (reduce || settled.current || !controls.current) return;
    const c = controls.current;
    const cam = camera as OrthographicCamera;
    const g = goal.current;
    const k = 1 - Math.exp(-dt * 6);
    c.target.lerp(g.target, k);
    cam.zoom += (g.zoom - cam.zoom) * k;
    cam.updateProjectionMatrix();
    c.update();
    if (c.target.distanceTo(g.target) > 0.05 || Math.abs(g.zoom - cam.zoom) > 0.01) invalidate();
    else settled.current = true;
  });
}
