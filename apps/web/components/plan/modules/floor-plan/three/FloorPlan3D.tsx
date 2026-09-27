"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorPlan3DProps } from "./types";

function Poster({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-oh-charcoal" aria-busy="true">
      <p className="m-0 animate-pulse text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{text}</p>
    </div>
  );
}

const Scene = dynamic(() => import("./Scene"), { ssr: false, loading: () => null });

/** Warm the chunk before the user commits, e.g. on hover of the 3D radio. */
export function preloadFloorPlan3D(): void {
  void import("./Scene");
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The isometric view: detects WebGL, lazy-loads the three.js scene, shows a
 * poster until the first frame, and hands unavailability back to the module
 * so it can fall back to the blueprint. The canvas is an image to assistive
 * tech; the 2D pods remain the keyboard path.
 */
export function FloorPlan3D(props: FloorPlan3DProps) {
  const { canvasAria, labels, onUnavailable } = props;
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [coarse, setCoarse] = useState(false);
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  // Detect once on mount. The module re-renders every frame while the journey
  // plays, so this must not depend on the (possibly inline) callback.
  useEffect(() => {
    const ok = hasWebGL();
    setSupported(ok);
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    if (!ok) unavailable.current();
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const stableUnavailable = useCallback(() => unavailable.current(), []);

  return (
    <div role="img" aria-label={canvasAria} className="relative aspect-[7/5] w-full overflow-hidden bg-oh-charcoal">
      {supported ? (
        <div className="absolute inset-0" aria-hidden="true">
          <Scene {...props} onUnavailable={stableUnavailable} onReady={onReady} coarse={coarse} />
        </div>
      ) : null}
      {!ready ? <Poster text={labels.loading} /> : null}
    </div>
  );
}
