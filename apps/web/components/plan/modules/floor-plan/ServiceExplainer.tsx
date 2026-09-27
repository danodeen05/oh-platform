interface Step {
  key: "kitchen" | "corridor" | "hatch";
  title: string;
  body: string;
}
interface Props {
  title: string;
  lede: string;
  steps: readonly Step[];
}

const CREAM = "#F2EDE4";
const EMBER = "#C1502E";
const GOLD = "#C9A227";
const MUTE = "#9A9188";

/** 96 x 64 diagrams in cream on ink, one accent each. */
function Diagram({ kind }: { kind: Step["key"] }) {
  const common = { width: 96, height: 64, viewBox: "0 0 96 64", "aria-hidden": true as const, className: "shrink-0" };
  if (kind === "kitchen") {
    return (
      <svg {...common}>
        <rect x="8" y="14" width="80" height="26" fill="none" stroke={CREAM} strokeWidth="1.5" />
        {[22, 40, 58, 76].map((x) => (
          <line key={x} x1={x} y1="40" x2={x} y2="50" stroke={EMBER} strokeWidth="2.5" />
        ))}
        <line x1="8" y1="40" x2="88" y2="40" stroke={EMBER} strokeWidth="1.5" />
        <text x="48" y="30" fill={MUTE} fontSize="8" textAnchor="middle" letterSpacing="0.12em">KITCHEN</text>
      </svg>
    );
  }
  if (kind === "corridor") {
    return (
      <svg {...common}>
        <rect x="40" y="6" width="16" height="52" fill={EMBER} fillOpacity="0.35" stroke={EMBER} strokeWidth="1.5" />
        {[10, 24, 38].map((y) => (
          <g key={y}>
            <rect x="18" y={y} width="20" height="10" fill="none" stroke={CREAM} strokeWidth="1" />
            <line x1="38" y1={y + 1} x2="38" y2={y + 9} stroke={EMBER} strokeWidth="2.5" />
            <rect x="58" y={y} width="20" height="10" fill="none" stroke={CREAM} strokeWidth="1" />
            <line x1="58" y1={y + 1} x2="58" y2={y + 9} stroke={EMBER} strokeWidth="2.5" />
          </g>
        ))}
        <line x1="48" y1="10" x2="48" y2="52" stroke={CREAM} strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="18" y="12" width="60" height="40" fill="none" stroke={CREAM} strokeWidth="1.5" />
      <rect x="18" y="12" width="30" height="40" fill={GOLD} fillOpacity="0.25" />
      <rect x="48" y="12" width="30" height="40" fill={EMBER} fillOpacity="0.25" />
      <line x1="48" y1="12" x2="48" y2="24" stroke={CREAM} strokeWidth="2" />
      <line x1="48" y1="40" x2="48" y2="52" stroke={CREAM} strokeWidth="2" />
      <line x1="48" y1="24" x2="48" y2="40" stroke={EMBER} strokeWidth="3" />
      <circle cx="60" cy="32" r="4" fill={CREAM} />
      <path d="M56 32 L38 32" stroke={CREAM} strokeWidth="1.5" markerEnd="none" />
      <path d="M40 29 L36 32 L40 35" fill="none" stroke={CREAM} strokeWidth="1.5" />
    </svg>
  );
}

/** Three moves, all behind the wall: fire, carry, hand over. */
export function ServiceExplainer({ title, lede, steps }: Props) {
  return (
    <section aria-labelledby="floor-plan-explainer" className="mt-12 md:mt-16">
      <h2 id="floor-plan-explainer" className="m-0 mb-1 font-display text-[1.5rem] leading-tight text-oh-cream md:text-[1.8rem]">
        {title}
      </h2>
      <p className="m-0 mb-6 max-w-3xl text-[0.95rem] leading-relaxed text-oh-mute">{lede}</p>
      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.key} className="flex gap-4 rounded-lg border border-oh-stone bg-oh-ink p-4 md:flex-col">
            <Diagram kind={s.key} />
            <div>
              <p className="m-0 mb-1 font-display text-[0.85rem] tracking-[0.2em] text-oh-ember-light">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="m-0 mb-1 font-display text-[1.2rem] leading-tight text-oh-cream">{s.title}</h3>
              <p className="m-0 text-[0.88rem] leading-relaxed text-oh-mute">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
