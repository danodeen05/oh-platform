import { useMemo } from "react";
import { BUILDING, DIMS, DOORS, HEIGHTS, KIOSKS, PASS, WALLS, ZONES, type LayerKey, type Point, type Rect, type Wall } from "../layout";
import { P, dim } from "./palette";
import type { IsoFocus } from "./types";

const T = 0.5; // wall thickness in feet

interface Seg {
  a: Point;
  b: Point;
  height: number;
}

/** Remove the door spans from a wall segment so doors read as gaps. */
function cutDoors(w: Wall): Wall[] {
  const [a, b] = w;
  const horizontal = a[1] === b[1];
  const spans = DOORS.filter((d) => (horizontal ? d.axis === "x" && d.y === a[1] : d.axis === "y" && d.x === a[0]));
  let pieces: Wall[] = [[a, b]];
  for (const d of spans) {
    const lo = horizontal ? d.x : d.y;
    const hi = lo + d.len;
    pieces = pieces.flatMap(([p, q]): Wall[] => {
      const s = horizontal ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]);
      const e = horizontal ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]);
      if (hi <= s || lo >= e) return [[p, q]];
      const out: Wall[] = [];
      const fixed = horizontal ? p[1] : p[0];
      if (lo > s) out.push(horizontal ? [[s, fixed], [lo, fixed]] : [[fixed, s], [fixed, lo]]);
      if (hi < e) out.push(horizontal ? [[hi, fixed], [e, fixed]] : [[fixed, hi], [fixed, e]]);
      return out;
    });
  }
  return pieces;
}

/** Front and right exterior walls sit low so the interior reads from the iso viewpoint. */
function heightFor(w: Wall): number {
  const [a, b] = w;
  const front = a[1] === BUILDING.h && b[1] === BUILDING.h;
  const right = a[0] === BUILDING.w && b[0] === BUILDING.w;
  if (front || right) return HEIGHTS.wall * 0.35;
  const interior = !(a[1] === 0 && b[1] === 0) && !(a[0] === 0 && b[0] === 0);
  return interior ? HEIGHTS.wall * 0.55 : HEIGHTS.wall;
}

function WallBox({ seg }: { seg: Seg }) {
  const { a, b, height } = seg;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len === 0) return null;
  const horizontal = a[1] === b[1];
  return (
    <mesh position={[(a[0] + b[0]) / 2, height / 2, (a[1] + b[1]) / 2]} castShadow receiveShadow>
      <boxGeometry args={horizontal ? [len + T, height, T] : [T, height, len + T]} />
      <meshStandardMaterial color={P.wall} roughness={0.9} flatShading />
    </mesh>
  );
}

function Block({ r, height, color, y = 0 }: { r: Rect; height: number; color: string; y?: number }) {
  return (
    <mesh position={[r.x + r.w / 2, y + height / 2, r.y + r.h / 2]} castShadow receiveShadow>
      <boxGeometry args={[r.w, height, r.h]} />
      <meshStandardMaterial color={color} roughness={0.85} flatShading />
    </mesh>
  );
}

const kitchen = ZONES.find((z) => z.key === "kitchen")!;
const store = ZONES.find((z) => z.key === "store")!;
/** Four stations along the kitchen back wall: broth, noodles, plating, dish-side prep. */
const STATIONS: readonly Rect[] = [4, 15, 26, 37].map((x) => ({ x, y: 1, w: 7, h: 3 }));
const SHELVES: readonly Rect[] = [
  { x: store.x + 0.6, y: store.y + 1, w: 1.2, h: store.h - 2 },
  { x: store.x + store.w - 1.8, y: store.y + 1, w: 1.2, h: store.h - 5 },
];

interface Props {
  layers: Record<LayerKey, boolean>;
  focus: IsoFocus;
}

/** Walls with door gaps, plus the few fixtures that make each zone legible. */
export function Walls({ layers, focus }: Props) {
  const segs = useMemo<Seg[]>(() => WALLS.flatMap((w) => cutDoors(w).map((p) => ({ a: p[0], b: p[1], height: heightFor(w) }))), []);
  const staffOn = focus === "all" || focus === "staff";
  const guestOn = focus === "all" || focus === "guest";
  const tone = (hex: string, on: boolean): string => (on ? hex : `#${dim(hex).getHexString()}`);
  return (
    <group>
      {segs.map((s, i) => (
        <WallBox key={i} seg={s} />
      ))}
      {layers.kitchen ? (
        <group>
          {STATIONS.map((r, i) => (
            <Block key={i} r={r} height={HEIGHTS.counter} color={tone(P.equipment, staffOn)} />
          ))}
          <Block r={{ ...PASS, x: PASS.x + 0.5, w: kitchen.w - 1 }} height={HEIGHTS.counter} color={tone(P.pass, staffOn)} />
        </group>
      ) : null}
      {layers.store
        ? SHELVES.map((r, i) => <Block key={i} r={r} height={HEIGHTS.counter * 2} color={tone(P.shelf, guestOn)} />)
        : null}
      {layers.entry
        ? KIOSKS.map((k, i) => <Block key={i} r={k} height={HEIGHTS.kiosk} color={tone(P.kiosk, guestOn)} />)
        : null}
      {DOORS.filter((d) => d.swing !== "none").map((d) => {
        const r: Rect = d.axis === "x" ? { x: d.x, y: d.y - 0.3, w: d.len, h: 0.6 } : { x: d.x - 0.3, y: d.y, w: 0.6, h: d.len };
        return <Block key={d.key} r={r} height={0.12} color={tone(P.door, d.territory === "staff" ? staffOn : guestOn)} y={HEIGHTS.floor} />;
      })}
      {/* corridor closures rise to partition height so the fingers read as sealed */}
      {layers.corridors
        ? [0, 1, 2].map((i) => {
            const x = DIMS.aisleW + i * (2 * DIMS.podDepth + DIMS.corridorW + DIMS.aisleW) + DIMS.podDepth;
            return <Block key={i} r={{ x, y: DIMS.rear + DIMS.fingerLen - 0.25, w: DIMS.corridorW, h: 0.5 }} height={HEIGHTS.podPartition} color={tone(P.wall, staffOn)} />;
          })
        : null}
    </group>
  );
}
