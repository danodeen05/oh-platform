import { useEffect, useRef, type ComponentRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "@react-three/drei";
import { OrthographicCamera, Vector3 } from "three";
import { BUILDING, DIMS, FINGERS, ZONES } from "../layout";
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

interface PresetView {
  x: number;
  z: number;
  /** How many feet of plan fit across the viewport. */
  viewFt: number;
}
const lobby = ZONES.find((z) => z.key === "lobby")!;
const finger2 = FINGERS[1]!;
export const PRESET_VIEWS: Record<IsoPreset, PresetView> = {
  overview: { x: BUILDING.w / 2 + 4, z: BUILDING.h / 2 - 2, viewFt: 122 },
  kitchen: { x: DIMS.kitchenW / 2, z: DIMS.rear / 2 + 3, viewFt: 62 },
  finger: { x: finger2.x + finger2.w / 2, z: finger2.y + finger2.h / 2, viewFt: 42 },
  lobby: { x: lobby.x + lobby.w / 2, z: lobby.y + lobby.h / 2, viewFt: 38 },
};

/**
 * Frames a preset: the orbit target and the orthographic zoom (pixels per
 * foot). Eases there unless motion is reduced, in which case it snaps.
 */
export function useIsoCamera(preset: IsoPreset, reduce: boolean, controls: RefObject<Controls | null>): void {
  const { camera, size, invalidate } = useThree();
  const goal = useRef<{ target: Vector3; zoom: number }>({ target: new Vector3(), zoom: 8 });
  const settled = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const v = PRESET_VIEWS[preset];
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
  }, [preset, size.width, reduce, camera, controls, invalidate]);

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
