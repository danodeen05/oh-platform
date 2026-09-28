import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Group, Line, LineDashedMaterial, Vector3 } from "three";
import { HEIGHTS, type Point } from "../layout";
import { useSceneLayout } from "./layout-context";
import { P } from "./palette";
import type { IsoFocus, Journey } from "./types";

interface Props {
  journey: MutableRefObject<Journey>;
  focus: IsoFocus;
  showPaths: boolean;
}

function dashedLine(path: readonly Point[], hex: string, y: number): Line {
  const g = new BufferGeometry().setFromPoints(path.map(([x, z]) => new Vector3(x, y, z)));
  const m = new LineDashedMaterial({ color: hex, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.85, depthTest: false });
  const line = new Line(g, m);
  line.renderOrder = 5;
  line.computeLineDistances();
  return line;
}

function Marker({ hex }: { hex: string }) {
  // A pin above partition height, drawn through walls, so the actor is never lost behind a pod.
  return (
    <group>
      <mesh position={[0, HEIGHTS.podPartition + 2.6, 0]} renderOrder={20}>
        <sphereGeometry args={[0.7, 14, 10]} />
        <meshBasicMaterial color={hex} depthTest={false} />
      </mesh>
      <mesh position={[0, (HEIGHTS.podPartition + 2.6) / 2 + 1.6, 0]} renderOrder={20}>
        <cylinderGeometry args={[0.06, 0.06, HEIGHTS.podPartition + 2.6 - 1.6, 6]} />
        <meshBasicMaterial color={hex} depthTest={false} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/** The guest and the runner, moved every frame from the shared journey ref; their paths as dashed ribbons. */
export function Actors({ journey, focus, showPaths }: Props) {
  const guest = useRef<Group>(null);
  const runner = useRef<Group>(null);
  const layout = useSceneLayout();
  const lines = useMemo(
    () => ({
      guestIn: dashedLine(layout.guestPath, P.guest, 0.25),
      guestOut: dashedLine(layout.guestExitPath, P.guest, 0.25),
      bowl: dashedLine(layout.bowlPath, P.runner, 0.25),
      dirty: dashedLine(layout.dirtyPath, P.runner, 0.25),
    }),
    [layout],
  );
  useEffect(
    () => () => {
      for (const l of Object.values(lines)) {
        l.geometry.dispose();
        (l.material as LineDashedMaterial).dispose();
      }
    },
    [lines],
  );

  useFrame(() => {
    const j = journey.current;
    if (guest.current) {
      guest.current.visible = j.guest !== null && j.progress > 0;
      if (j.guest) guest.current.position.set(j.guest[0], 0, j.guest[1]);
    }
    if (runner.current) {
      runner.current.visible = j.bowl !== null && j.progress > 0;
      if (j.bowl) runner.current.position.set(j.bowl[0], 0, j.bowl[1]);
    }
  });

  const guestOn = focus === "all" || focus === "guest";
  const staffOn = focus === "all" || focus === "staff";
  return (
    <group>
      {showPaths && guestOn ? <primitive object={lines.guestIn} /> : null}
      {showPaths && guestOn ? <primitive object={lines.guestOut} /> : null}
      {showPaths && staffOn ? <primitive object={lines.bowl} /> : null}
      {showPaths && staffOn ? <primitive object={lines.dirty} /> : null}
      <group ref={guest} visible={false}>
        <mesh position={[0, 1.6, 0]} castShadow>
          <capsuleGeometry args={[0.55, 2.2, 4, 10]} />
          <meshStandardMaterial color={P.guest} roughness={0.7} />
        </mesh>
        <Marker hex={P.guest} />
      </group>
      <group ref={runner} visible={false}>
        <mesh position={[0, 1.6, 0]} castShadow>
          <capsuleGeometry args={[0.55, 2.2, 4, 10]} />
          <meshStandardMaterial color={P.runner} roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.5, 0.9]}>
          <sphereGeometry args={[0.45, 12, 8]} />
          <meshStandardMaterial color={P.bowl} roughness={0.5} />
        </mesh>
        <Marker hex={P.runner} />
      </group>
    </group>
  );
}
