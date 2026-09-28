import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from "three";
import { HEIGHTS, type ZoneKey } from "../layout";
import { useSceneLayout } from "./layout-context";
import type { IsoLabels } from "./types";

interface Props {
  labels: IsoLabels;
  /** Hidden on narrow viewports where they would collide. */
  show: boolean;
}


/** A label as a sprite with a canvas texture: no DOM, no extra React roots, always faces the camera. */
function makeSprite(text: string, widthFt: number): Sprite {
  const scale = 4; // texture oversampling
  const font = `500 ${11 * scale}px Raleway, system-ui, sans-serif`;
  const pad = 6 * scale;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const upper = text.toUpperCase();
  const textW = measure.measureText(upper).width + upper.length * 1.4 * scale; // letter-spacing
  const w = Math.ceil(textW + pad * 2);
  const h = Math.ceil(16 * scale + pad);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(28,27,25,0.78)";
  ctx.fillRect(0, 0, w, h);
  ctx.font = font;
  ctx.fillStyle = "#F2EDE4";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = `${1.4 * scale}px`;
  ctx.fillText(upper, pad, h / 2 + scale);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  const mat = new SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new Sprite(mat);
  s.scale.set(widthFt, (widthFt * h) / w, 1);
  s.renderOrder = 10;
  return s;
}

/** At most six labels, placed above what they name. */
export function Labels({ labels, show }: Props) {
  const layout = useSceneLayout();
  const items = useMemo(() => {
    const zone = (key: ZoneKey) => layout.zones.find((z) => z.key === key)!;
    const corridor2 = layout.staffCorridors[1]!;
    const aisle2 = layout.guestAisles[1]!;
    return [
      { key: "kitchen", text: labels.kitchen, x: zone("kitchen").x + zone("kitchen").w / 2, y: HEIGHTS.wall + 1.5, z: zone("kitchen").y + 3 },
      { key: "lobby", text: labels.lobby, x: zone("lobby").x + zone("lobby").w / 2, y: HEIGHTS.kiosk + 2, z: zone("lobby").y + zone("lobby").h - 4 },
      { key: "store", text: labels.store, x: zone("store").x + zone("store").w / 2, y: HEIGHTS.counter * 2 + 1.5, z: zone("store").y + zone("store").h / 2 },
      { key: "restrooms", text: labels.restrooms, x: zone("restroomHall").x + zone("restroomHall").w / 2, y: HEIGHTS.wall * 0.55 + 1.5, z: zone("restroomHall").y + 2 },
      { key: "corridor", text: `${labels.corridor} 2`, x: corridor2.x + corridor2.w / 2, y: HEIGHTS.podPartition + 2.5, z: corridor2.y + 4 },
      { key: "aisle", text: `${labels.aisle} 2`, x: aisle2.x + aisle2.w / 2, y: 1.2, z: aisle2.y + aisle2.h + 2.5 },
    ];
  }, [labels, layout]);
  const sprites = useMemo(() => (typeof document === "undefined" ? [] : items.map((it) => ({ key: it.key, sprite: makeSprite(it.text, Math.max(9, it.text.length * 0.9)), pos: [it.x, it.y, it.z] as const }))), [items]);
  useEffect(
    () => () => {
      for (const { sprite } of sprites) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    },
    [sprites],
  );
  if (!show) return null;
  return (
    <group>
      {sprites.map(({ key, sprite, pos }) => (
        <primitive key={key} object={sprite} position={[pos[0], pos[1], pos[2]]} />
      ))}
    </group>
  );
}
