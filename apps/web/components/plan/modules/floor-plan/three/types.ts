import type { LayerKey, Pod } from "../layout";

export type IsoPreset = "overview" | "kitchen" | "finger" | "lobby";
export type IsoFocus = "all" | "guest" | "staff";

export interface IsoLabels {
  kitchen: string;
  lobby: string;
  store: string;
  restrooms: string;
  corridor: string;
  aisle: string;
  loading: string;
}

export interface FloorPlan3DProps {
  layers: Record<LayerKey, boolean>;
  progress: number;
  guest: [number, number] | null;
  bowl: [number, number] | null;
  activePod: number | null;
  reduce: boolean;
  preset: IsoPreset;
  focus: IsoFocus;
  labels: IsoLabels;
  canvasAria: string;
  onPodEnter: (pod: Pod) => void;
  onPodLeave: () => void;
  onPodActivate: (pod: Pod) => void;
  onUnavailable: () => void;
}

/** What the scene reads every frame; the module writes it, the canvas never re-renders for it. */
export interface Journey {
  progress: number;
  guest: [number, number] | null;
  bowl: [number, number] | null;
}
