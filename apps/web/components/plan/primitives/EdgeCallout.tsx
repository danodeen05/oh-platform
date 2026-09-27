export interface EdgePoint {
  /** The claim, in plain words. */
  text: string;
  /** Oh!'s figure, already formatted (for example "23.9%"). */
  figure?: string;
  /** The public benchmark it beats, already formatted (for example "25 to 32%"). */
  benchmark?: string;
}

interface Props {
  title: string;
  /** Column labels for the figure pair, e.g. "Oh!" and "Benchmark". */
  labels: { oh: string; benchmark: string };
  points: readonly EdgePoint[];
  /** Dark for the interactive plan, light for the print route. */
  tone?: "dark" | "light";
  className?: string;
  "data-edge"?: string;
}

const TONE = {
  dark: { box: "bg-oh-ink/70", title: "text-oh-ember-light", text: "text-oh-cream", meta: "text-oh-mute", metaLabel: "text-oh-mute/80", figure: "text-oh-cream" },
  light: { box: "bg-oh-cream/60", title: "text-oh-ember-deep", text: "text-oh-charcoal", meta: "text-oh-stone", metaLabel: "text-oh-clay", figure: "text-oh-charcoal" },
} as const;

/**
 * "Where Oh! is different": one recognizable device under every section
 * opener. Two to four points; each figure is engine-derived and compared
 * against the same public benchmark table the integrity scorecard reads,
 * so a claim here can never contradict the scorecard. Hook-free so print
 * and server components render it.
 */
export function EdgeCallout({ title, labels, points, tone = "dark", className, ...rest }: Props) {
  const c = TONE[tone];
  return (
    <aside aria-label={title} data-edge={rest["data-edge"]} className={["my-8 rounded-lg border-l-2 border-oh-ember px-5 py-4 md:px-6", c.box, className ?? ""].join(" ")}>
      <p className={["m-0 mb-3 text-[0.68rem] uppercase tracking-[0.16em]", c.title].join(" ")}>{title}</p>
      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-oh-ember" />
            <div className="min-w-0">
              <p className={["m-0 text-[0.95rem] leading-snug", c.text].join(" ")}>{p.text}</p>
              {p.figure ? (
                <p className={["m-0 mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.78rem] tabular-nums", c.meta].join(" ")}>
                  <span>
                    <span className={["uppercase tracking-[0.12em]", c.metaLabel].join(" ")}>{labels.oh}</span> <span className={["font-display text-[0.95rem]", c.figure].join(" ")}>{p.figure}</span>
                  </span>
                  {p.benchmark ? (
                    <span>
                      <span className={["uppercase tracking-[0.12em]", c.metaLabel].join(" ")}>{labels.benchmark}</span> <span className="font-display text-[0.95rem]">{p.benchmark}</span>
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
