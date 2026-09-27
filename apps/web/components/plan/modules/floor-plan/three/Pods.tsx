import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Object3D, Vector3 } from "three";
import { HEIGHTS, JOURNEY_POD, PHASES, POD, PODS, type Pod } from "../layout";
import { P, color, dim } from "./palette";
import type { IsoFocus, Journey } from "./types";

interface Props {
  focus: IsoFocus;
  activePod: number | null;
  journey: MutableRefObject<Journey>;
  onPodEnter: (pod: Pod) => void;
  onPodLeave: () => void;
  onPodActivate: (pod: Pod) => void;
}

const HATCH_W = POD.w * 0.72;
const HATCH_H = HEIGHTS.hatchHead - HEIGHTS.hatchSill;
const HATCH_Y = HEIGHTS.hatchSill + HATCH_H / 2;

function shellMatrix(p: Pod, out: Matrix4): Matrix4 {
  return out.makeTranslation(p.x + p.w / 2, HEIGHTS.podPartition / 2, p.y + p.h / 2);
}
function hatchMatrix(p: Pod, slide: number, out: Matrix4): Matrix4 {
  const x = p.hatch === "east" ? p.x + p.w + 0.03 : p.x - 0.03;
  const o = new Object3D();
  o.position.set(x, HATCH_Y, p.y + p.h / 2 + slide);
  o.rotation.y = Math.PI / 2;
  o.updateMatrix();
  return out.copy(o.matrix);
}
function seatMatrix(p: Pod, out: Matrix4): Matrix4 {
  const x = p.facing === "west" ? p.x + 0.03 : p.x + p.w - 0.03;
  const o = new Object3D();
  o.position.set(x, HEIGHTS.podPartition * 0.42, p.y + p.h / 2);
  o.rotation.y = Math.PI / 2;
  o.updateMatrix();
  return out.copy(o.matrix);
}

/** Every pod's twelve box edges in one line set: one draw call for the blueprint look. */
function edgeGeometry(): BufferGeometry {
  const pts: number[] = [];
  const h = HEIGHTS.podPartition;
  for (const p of PODS) {
    const x0 = p.x;
    const x1 = p.x + p.w;
    const z0 = p.y;
    const z1 = p.y + p.h;
    const c = [
      [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1],
      [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1],
    ] as const;
    const e = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ] as const;
    for (const [a, b] of e) pts.push(...c[a], ...c[b]);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pts, 3));
  return g;
}

/** Hatch openness 0..1 across the "hatch" and "delivered" beats. */
function openness(progress: number): number {
  const [a, b] = PHASES.bowl;
  const open = b; // delivered
  const start = a + (b - a) * 0.66; // "hatch" beat
  if (progress < start) return 0;
  if (progress < open) return (progress - start) / (open - start);
  const close = open + 0.04;
  if (progress < close) return 1 - (progress - open) / (close - open);
  return 0;
}

export function Pods({ focus, activePod, journey, onPodEnter, onPodLeave, onPodActivate }: Props) {
  const shell = useRef<InstancedMesh>(null);
  const hatch = useRef<InstancedMesh>(null);
  const seat = useRef<InstancedMesh>(null);
  const hover = useRef<Pod | null>(null);
  const lastSlide = useRef(-1);
  const { invalidate, gl } = useThree();
  const edges = useMemo(edgeGeometry, []);
  useEffect(() => () => edges.dispose(), [edges]);

  // Instance matrices once.
  useLayoutEffect(() => {
    const m = new Matrix4();
    PODS.forEach((p, i) => {
      shell.current?.setMatrixAt(i, shellMatrix(p, m));
      hatch.current?.setMatrixAt(i, hatchMatrix(p, 0, m));
      seat.current?.setMatrixAt(i, seatMatrix(p, m));
    });
    for (const ref of [shell, hatch, seat]) if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [invalidate]);

  // Colors: territory focus and the active pod.
  useLayoutEffect(() => {
    const guestOn = focus === "all" || focus === "guest";
    const staffOn = focus === "all" || focus === "staff";
    PODS.forEach((p, i) => {
      const isActive = p.number === activePod;
      const shellHex = isActive ? P.active : p.type === "duo" ? "#33301F" : P.podShell;
      shell.current?.setColorAt(i, guestOn ? color(shellHex) : dim(shellHex));
      hatch.current?.setColorAt(i, staffOn ? color(isActive ? P.hatchOpen : P.hatch) : dim(P.hatch));
      seat.current?.setColorAt(i, guestOn ? color(P.podSeat) : dim(P.podSeat, 0.5));
    });
    for (const ref of [shell, hatch, seat]) if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [focus, activePod, invalidate]);

  // The journey pod's hatch slides open at delivery.
  useFrame(() => {
    const slide = openness(journey.current.progress) * HATCH_W * 0.9;
    if (Math.abs(slide - lastSlide.current) < 1e-4 || !hatch.current) return;
    lastSlide.current = slide;
    const i = PODS.findIndex((p) => p.number === JOURNEY_POD);
    const p = PODS[i];
    if (!p) return;
    const m = new Matrix4();
    hatch.current.setMatrixAt(i, hatchMatrix(p, slide, m));
    hatch.current.instanceMatrix.needsUpdate = true;
  });

  const podAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Pod | undefined => (e.instanceId !== undefined ? PODS[e.instanceId] : undefined);

  return (
    <group>
      <instancedMesh
        ref={shell}
        args={[undefined, undefined, PODS.length]}
        castShadow
        receiveShadow
        onPointerMove={(e) => {
          e.stopPropagation();
          const p = podAt(e);
          if (p && p !== hover.current) {
            hover.current = p;
            gl.domElement.style.cursor = "pointer";
            onPodEnter(p);
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          hover.current = null;
          gl.domElement.style.cursor = "";
          onPodLeave();
        }}
        onClick={(e) => {
          e.stopPropagation();
          const p = podAt(e);
          if (p) onPodActivate(p);
        }}
      >
        <boxGeometry args={[POD.d, HEIGHTS.podPartition, POD.w]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={hatch} args={[undefined, undefined, PODS.length]} raycast={() => null}>
        <planeGeometry args={[HATCH_W, HATCH_H]} />
        <meshStandardMaterial roughness={0.6} emissive={P.hatch} emissiveIntensity={0.25} side={2} />
      </instancedMesh>
      <instancedMesh ref={seat} args={[undefined, undefined, PODS.length]} raycast={() => null}>
        <planeGeometry args={[POD.w * 0.8, HEIGHTS.podPartition * 0.8]} />
        <meshStandardMaterial roughness={1} side={2} />
      </instancedMesh>
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color={P.edgeSoft} transparent opacity={0.55} />
      </lineSegments>
      {/* invisible anchor so Vector3 import stays meaningful for type parity with actors */}
      <object3D position={new Vector3(0, 0, 0)} />
    </group>
  );
}
