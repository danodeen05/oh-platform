import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { HEIGHTS, type LayerKey, type Layout, type Rect, type Territory } from "../layout";
import { useSceneLayout } from "./layout-context";
import { P, dim } from "./palette";
import type { IsoFocus } from "./types";

interface Room extends Rect {
  key: string;
  territory: Territory;
  layer: LayerKey;
  color: string;
}

function roomsOf(layout: Layout): readonly Room[] {
  return [
    ...layout.zones.map((z): Room => ({
      key: z.key,
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      territory: z.territory,
      layer: z.key === "kitchen" ? "kitchen" : z.key === "dish" || z.key === "boh" ? "boh" : z.key.startsWith("restroom") ? "restrooms" : z.key === "store" ? "store" : "entry",
      color: z.key.startsWith("restroom") ? P.floorRestroom : z.key === "store" ? P.floorStore : P.floor[z.territory],
    })),
    ...layout.staffCorridors.map((c): Room => ({ key: c.key, x: c.x, y: c.y, w: c.w, h: c.h, territory: "staff", layer: "corridors", color: P.floor.staff })),
    ...layout.guestAisles.map((a): Room => ({ key: a.key, x: a.x, y: a.y, w: a.w, h: a.h, territory: "guest", layer: "aisles", color: P.floor.guest })),
    { key: "cross", ...layout.crossAisle, territory: "guest", layer: "aisles", color: P.floor.guest },
    ...layout.rows.map((r): Room => ({ key: `row-${r.key}`, x: r.x, y: r.y, w: r.w, h: r.h, territory: "guest", layer: "pods", color: P.floor.guest })),
  ];
}

interface Props {
  layers: Record<LayerKey, boolean>;
  focus: IsoFocus;
}

/** One thin slab per rectangle, colored by territory, with a cream edge for the blueprint feel. */
export function Floors({ layers, focus }: Props) {
  const layout = useSceneLayout();
  const all = useMemo(() => roomsOf(layout), [layout]);
  const rooms = useMemo(() => all.filter((r) => layers[r.layer]), [all, layers]);
  return (
    <group>
      {/* ground under everything so the shell reads as one object */}
      <mesh position={[35, -0.05, 25]} receiveShadow>
        <boxGeometry args={[70.6, 0.1, 50.6]} />
        <meshStandardMaterial color={P.wall} roughness={1} />
      </mesh>
      {rooms.map((r) => {
        const on = focus === "all" || focus === r.territory;
        return (
          <mesh key={r.key} position={[r.x + r.w / 2, HEIGHTS.floor / 2, r.y + r.h / 2]} receiveShadow>
            <boxGeometry args={[r.w, HEIGHTS.floor, r.h]} />
            <meshStandardMaterial color={on ? r.color : dim(r.color)} roughness={0.95} flatShading />
            <Edges color={on ? P.edgeSoft : P.wall} threshold={15} />
          </mesh>
        );
      })}
    </group>
  );
}
