import { ANIMATED_STEPS, JOURNEY_STEPS, type Actor, type JourneyStep } from "./layout";

interface Props {
  progress: number;
  actorLabel: (actor: Actor) => string;
  stepText: (key: JourneyStep["key"]) => string;
  fmtClock: (seconds: number) => string;
  after: string;
  note: string;
}

const badge: Record<Actor, string> = {
  guest: "border-oh-gold text-oh-gold",
  kitchen: "border-oh-ember-light text-oh-ember-light",
  both: "border-oh-cream text-oh-cream",
};
const rail: Record<Actor, string> = {
  guest: "border-oh-gold",
  kitchen: "border-oh-ember-light",
  both: "border-oh-cream",
};

/**
 * One interleaved timeline with a badge per actor. Reached steps carry their
 * actor's color on the left rail; the current one is brightest. Steps with no
 * animation anchor sit under an "Afterwards" divider.
 */
export function JourneyTimeline({ progress, actorLabel, stepText, fmtClock, after, note }: Props) {
  const reachedIndex = progress > 0 ? ANIMATED_STEPS.reduce((acc, s, i) => ((s.at as number) <= progress ? i : acc), -1) : -1;
  const later = JOURNEY_STEPS.filter((s) => s.at === null);

  const row = (s: JourneyStep, state: "current" | "reached" | "pending") => (
    <li
      key={s.key}
      aria-current={state === "current" ? "step" : undefined}
      className={[
        "grid grid-cols-[3.2rem_1fr] gap-x-2 border-l-2 py-1.5 pl-3 text-[0.8rem] leading-snug transition-colors",
        state === "pending" ? "border-oh-stone text-oh-mute" : `${rail[s.actor]} text-oh-cream`,
        state === "current" ? "bg-oh-ink/70" : "",
      ].join(" ")}
    >
      <span className="font-display tabular-nums text-[0.9rem] text-oh-cream">{fmtClock(s.realSeconds)}</span>
      <span>
        <span className={`mr-2 inline-block rounded-sm border px-1 py-px text-[0.6rem] uppercase tracking-[0.12em] ${state === "pending" ? "border-oh-stone text-oh-mute" : badge[s.actor]}`}>{actorLabel(s.actor)}</span>
        {stepText(s.key)}
      </span>
    </li>
  );

  return (
    <div>
      <ol className="m-0 list-none space-y-0.5 p-0">
        {ANIMATED_STEPS.map((s, i) => row(s, i === reachedIndex ? "current" : i < reachedIndex ? "reached" : "pending"))}
      </ol>
      {later.length ? (
        <>
          <p className="m-0 mb-1 mt-3 text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{after}</p>
          <ol className="m-0 list-none space-y-0.5 p-0">{later.map((s) => row(s, "pending"))}</ol>
        </>
      ) : null}
      <p className="m-0 mt-3 text-[0.72rem] text-oh-mute">{note}</p>
    </div>
  );
}
