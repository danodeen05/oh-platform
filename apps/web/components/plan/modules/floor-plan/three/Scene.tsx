"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BUILDING } from "../layout";
import { Actors } from "./Actors";
import { Floors } from "./Floors";
import { Labels } from "./Labels";
import { P } from "./palette";
import { Pods } from "./Pods";
import type { FloorPlan3DProps, Journey } from "./types";
import { ISO_AZ, ISO_EL, isoOffset, useIsoCamera, type Controls } from "./useIsoCamera";
import { Walls } from "./Walls";
import { PLAN_LAYOUT, SceneLayoutContext } from "./layout-context";

type SceneProps = FloorPlan3DProps & { onReady: () => void; coarse: boolean };

function Rig({ preset, reduce, coarse }: Pick<SceneProps, "preset" | "reduce" | "coarse">) {
  const controls = useRef<Controls | null>(null);
  useIsoCamera(preset, reduce, controls);
  const AZ = (30 * Math.PI) / 180;
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={!coarse}
      enableDamping={!reduce}
      dampingFactor={0.12}
      minAzimuthAngle={ISO_AZ - AZ}
      maxAzimuthAngle={ISO_AZ + AZ}
      minPolarAngle={Math.PI / 2 - ISO_EL - (12 * Math.PI) / 180}
      maxPolarAngle={Math.PI / 2 - ISO_EL + (18 * Math.PI) / 180}
      minZoom={4}
      maxZoom={40}
    />
  );
}

/** Copies the journey props into a ref every frame-relevant change, then asks for one frame. */
function JourneySync({ journey, progress, guest, bowl }: { journey: React.MutableRefObject<Journey>; progress: number; guest: Journey["guest"]; bowl: Journey["bowl"] }) {
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    journey.current = { progress, guest, bowl };
    invalidate();
  }, [journey, progress, guest, bowl, invalidate]);
  return null;
}

function Ready({ onReady }: { onReady: () => void }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    let frame = 0;
    frame = requestAnimationFrame(() => {
      gl.domElement.setAttribute("data-ready", "1");
      onReady();
    });
    invalidate();
    return () => cancelAnimationFrame(frame);
  }, [gl, invalidate, onReady]);
  return null;
}

export default function Scene(props: SceneProps) {
  const { layers, progress, guest, bowl, activePod, reduce, preset, focus, labels, onPodEnter, onPodLeave, onPodActivate, onUnavailable, onReady, coarse, layout } = props;
  const journey = useRef<Journey>({ progress: 0, guest: null, bowl: null });
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = (): void => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  // Canvas props are memoized: the parent re-renders every frame while the journey plays.
  const dpr = useMemo<[number, number]>(() => [1, coarse ? 1.5 : 2], [coarse]);
  const camera = useMemo(() => {
    const start = isoOffset().add({ x: BUILDING.w / 2, y: 0, z: BUILDING.h / 2 } as never);
    return { position: [start.x, start.y, start.z] as [number, number, number], zoom: 8, near: 0.1, far: 1000, up: [0, 1, 0] as [number, number, number] };
  }, []);
  const glProps = useMemo(() => ({ antialias: true, alpha: false }), []);
  const onCreated = useCallback(
    ({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
        // A lost context usually comes back (tab switch, GPU reset). Give it a
        // few seconds before treating the browser as unable to run 3D.
        let timer: number | undefined;
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          window.clearTimeout(timer);
          timer = window.setTimeout(onUnavailable, 4000);
        });
        gl.domElement.addEventListener("webglcontextrestored", () => window.clearTimeout(timer));
    },
    [onUnavailable],
  );

  return (
    <Canvas orthographic frameloop="demand" dpr={dpr} shadows={!coarse} camera={camera} gl={glProps} onCreated={onCreated} style={{ touchAction: "pan-y" }}>
      <SceneLayoutContext.Provider value={layout ?? PLAN_LAYOUT}>
        <color attach="background" args={[P.bg]} />
        <ambientLight intensity={1.3} />
        <hemisphereLight args={["#F2EDE4", "#1C1B19", 0.35]} />
        <directionalLight position={[40, 80, 60]} intensity={2.2} castShadow={!coarse} shadow-mapSize={[1024, 1024]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
        <Rig preset={preset} reduce={reduce} coarse={coarse} />
        <JourneySync journey={journey} progress={progress} guest={guest} bowl={bowl} />
        <Floors layers={layers} focus={focus} />
        <Walls layers={layers} focus={focus} />
        {layers.pods ? <Pods focus={focus} activePod={activePod} journey={journey} onPodEnter={onPodEnter} onPodLeave={onPodLeave} onPodActivate={onPodActivate} /> : null}
        <Actors journey={journey} focus={focus} showPaths={progress > 0 || layers.flow} />
        <Labels labels={labels} show={wide} />
        <Ready onReady={onReady} />
      </SceneLayoutContext.Provider>
    </Canvas>
  );
}
