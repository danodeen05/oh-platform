import { AISLES, BOWL_PATH, BUILDING, CORRIDORS, FT, GUEST_PATH, KIOSKS, PODS, ZONES, type LayerKey, type Pod } from "./layout";

export type Theme = "dark" | "light";

export interface FloorPlanSvgProps {
  theme: Theme;
  layers: Readonly<Record<LayerKey, boolean>>;
  labels: Record<"entry" | "dining" | "kitchen" | "boh" | "restrooms" | "kiosk" | "corridor" | "aisle" | "pass", string>;
  /** Pod number to highlight. */
  activePod?: number | null;
  /** Journey overlay: positions in feet. */
  guest?: [number, number] | null;
  bowl?: [number, number] | null;
  showPaths?: boolean;
  onPodEnter?: (pod: Pod) => void;
  onPodLeave?: () => void;
  onPodActivate?: (pod: Pod) => void;
  podLabel?: (pod: Pod) => string;
  className?: string;
}

const PALETTE = {
  dark: { bg: "#1C1B19", zone: "#2A2724", stroke: "#3A3632", text: "#9A9188", pod: "#F2EDE4", podFill: "rgba(242,237,228,0.06)", duo: "#C9A227", kitchen: "rgba(193,80,46,0.16)", corridor: "rgba(107,115,85,0.28)", aisle: "rgba(242,237,228,0.03)", active: "#C1502E", guest: "#C9A227", bowl: "#C1502E" },
  light: { bg: "#FAF7F1", zone: "#F2EDE4", stroke: "#8A8178", text: "#3A3632", pod: "#1C1B19", podFill: "rgba(28,27,25,0.04)", duo: "#8C5A3C", kitchen: "rgba(193,80,46,0.12)", corridor: "rgba(107,115,85,0.22)", aisle: "rgba(28,27,25,0.03)", active: "#C1502E", guest: "#8C5A3C", bowl: "#C1502E" },
} as const;

const px = (ft: number): number => ft * FT;
const poly = (path: readonly [number, number][]): string => path.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");

/**
 * Presentational SVG of the flagship. No hooks, so it renders on the server
 * for print and inside the interactive client module. Pods are focusable
 * buttons for keyboard users (spec 7.6).
 */
export function FloorPlanSvg({ theme, layers, labels, activePod = null, guest = null, bowl = null, showPaths = false, onPodEnter, onPodLeave, onPodActivate, podLabel, className }: FloorPlanSvgProps) {
  const c = PALETTE[theme];
  const zone = (key: string) => ZONES.find((z) => z.key === key);
  const entry = zone("entry");
  const kitchen = zone("kitchen");
  const boh = zone("boh");
  const restrooms = zone("restrooms");
  const label = (r: { x: number; y: number; w: number; h: number }, text: string, size = 11) => (
    <text x={px(r.x + r.w / 2)} y={px(r.y + r.h / 2)} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={size} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {text}
    </text>
  );
  return (
    <svg viewBox={`0 0 ${px(BUILDING.w)} ${px(BUILDING.h)}`} className={className} role="group" aria-label={labels.dining}>
      <rect x={0} y={0} width={px(BUILDING.w)} height={px(BUILDING.h)} fill={c.bg} stroke={c.stroke} strokeWidth={2} />
      {layers.entry && entry ? (
        <g>
          <rect x={px(entry.x)} y={px(entry.y)} width={px(entry.w)} height={px(entry.h)} fill={c.aisle} />
          {KIOSKS.map((k, i) => (
            <rect key={i} x={px(k.x)} y={px(k.y)} width={px(k.w)} height={px(k.h)} fill={c.zone} stroke={c.stroke} rx={2} />
          ))}
          <text x={px(2)} y={px(4.2)} fill={c.text} fontSize={10} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {labels.entry}
          </text>
          <text x={px(14.5)} y={px(1.65)} fill={c.text} fontSize={9} style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {labels.kiosk}
          </text>
        </g>
      ) : null}
      {layers.kitchen && kitchen ? (
        <g>
          <rect x={px(kitchen.x)} y={px(kitchen.y)} width={px(kitchen.w)} height={px(kitchen.h)} fill={c.kitchen} stroke={c.stroke} />
          {label(kitchen, labels.kitchen, 13)}
          <rect x={px(2)} y={px(25.5)} width={px(40)} height={px(1.2)} fill={c.zone} stroke={c.stroke} />
          <text x={px(22)} y={px(28.4)} textAnchor="middle" fill={c.text} fontSize={9} style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {labels.pass}
          </text>
        </g>
      ) : null}
      {layers.boh && boh ? (
        <g>
          <rect x={px(boh.x)} y={px(boh.y)} width={px(boh.w)} height={px(boh.h)} fill={c.zone} stroke={c.stroke} />
          {label(boh, labels.boh)}
        </g>
      ) : null}
      {layers.restrooms && restrooms ? (
        <g>
          <rect x={px(restrooms.x)} y={px(restrooms.y)} width={px(restrooms.w)} height={px(restrooms.h)} fill={c.zone} stroke={c.stroke} />
          <text x={px(restrooms.x + restrooms.w / 2)} y={px(restrooms.y + restrooms.h / 2)} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={9} transform={`rotate(-90 ${px(restrooms.x + restrooms.w / 2)} ${px(restrooms.y + restrooms.h / 2)})`} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {labels.restrooms}
          </text>
        </g>
      ) : null}
      {layers.corridors ? (
        <g>
          {AISLES.map((a) => (
            <rect key={a.key} x={px(a.x)} y={px(a.y)} width={px(a.w)} height={px(a.h)} fill={c.aisle} />
          ))}
          {CORRIDORS.map((r) => (
            <g key={r.key}>
              <rect x={px(r.x)} y={px(r.y)} width={px(r.w)} height={px(r.h)} fill={c.corridor} />
              <text x={px(r.x + r.w / 2)} y={px(r.y + r.h / 2)} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={9} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {labels.corridor}
              </text>
            </g>
          ))}
          <text x={px(35)} y={px(15.75)} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={9} style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {labels.aisle}
          </text>
        </g>
      ) : null}
      {layers.pods ? (
        <g>
          {PODS.map((p) => {
            const active = p.number === activePod;
            const panelY = p.panel === "north" ? px(p.y) : px(p.y + p.h);
            return (
              <g
                key={p.number}
                role={onPodActivate ? "button" : undefined}
                tabIndex={onPodActivate ? 0 : undefined}
                aria-label={podLabel ? podLabel(p) : undefined}
                onMouseEnter={onPodEnter ? () => onPodEnter(p) : undefined}
                onMouseLeave={onPodLeave}
                onFocus={onPodEnter ? () => onPodEnter(p) : undefined}
                onBlur={onPodLeave}
                onClick={onPodActivate ? () => onPodActivate(p) : undefined}
                onKeyDown={onPodActivate ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPodActivate(p); } } : undefined}
                style={onPodActivate ? { cursor: "pointer", outline: "none" } : undefined}
              >
                <rect x={px(p.x)} y={px(p.y)} width={px(p.w)} height={px(p.h)} fill={active ? c.active : c.podFill} stroke={p.type === "duo" ? c.duo : c.pod} strokeWidth={active ? 1.6 : 0.8} rx={1.5} opacity={active ? 1 : 0.9} />
                <line x1={px(p.x + 0.3)} y1={panelY} x2={px(p.x + p.w - 0.3)} y2={panelY} stroke={c.duo} strokeWidth={1.5} opacity={0.9} />
                <text x={px(p.x + p.w / 2)} y={px(p.y + p.h / 2)} textAnchor="middle" dominantBaseline="middle" fill={active ? c.pod : c.text} fontSize={7} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {p.number}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}
      {showPaths ? (
        <g fill="none" strokeDasharray="4 4" opacity={0.7}>
          <polyline points={poly(GUEST_PATH)} stroke={c.guest} strokeWidth={1.5} />
          <polyline points={poly(BOWL_PATH)} stroke={c.bowl} strokeWidth={1.5} />
        </g>
      ) : null}
      {guest ? <circle cx={px(guest[0])} cy={px(guest[1])} r={5} fill={c.guest} stroke={c.bg} strokeWidth={1.5} /> : null}
      {bowl ? <circle cx={px(bowl[0])} cy={px(bowl[1])} r={5} fill={c.bowl} stroke={c.bg} strokeWidth={1.5} /> : null}
    </svg>
  );
}
