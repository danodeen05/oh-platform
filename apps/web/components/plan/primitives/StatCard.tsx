import { CountUp, type CountUpKind } from "./CountUp";
import { registryHref } from "./SourceNotes";
import type { Currency } from "@oh/plan-model";

export interface StatWhy {
  /** One or two sentences: how the figure is built and what it depends on. */
  text: string;
  /** Register keys behind the figure; each becomes a link to its row. */
  registryKeys?: readonly string[];
  /** Labels for the disclosure and the link list. */
  labels: { open: string; register: string };
  locale: string;
}

interface Props {
  label: string;
  value: number;
  kind: CountUpKind;
  locale?: string;
  currency?: Currency;
  fractionDigits?: number;
  /** Small line under the figure, e.g. the benchmark or the definition. */
  note?: string;
  /** Ember for the headline figure, cream otherwise. */
  accent?: boolean;
  /** "Why this number": a native disclosure with the derivation and links to the register. */
  why?: StatWhy;
}

/** One figure, labeled. Every number passes through the engine's formatters. */
export function StatCard({ label, value, kind, locale, currency, fractionDigits, note, accent = false, why }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-oh-stone bg-oh-ink px-5 py-5">
      <span className="text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{label}</span>
      <CountUp
        value={value}
        kind={kind}
        {...(locale ? { locale } : {})}
        {...(currency ? { currency } : {})}
        {...(fractionDigits !== undefined ? { fractionDigits } : {})}
        className={["font-display text-[2.2rem] leading-none", accent ? "text-oh-ember" : "text-oh-cream"].join(" ")}
      />
      {note ? <span className="text-[0.8rem] leading-snug text-oh-mute">{note}</span> : null}
      {why ? (
        <details className="group mt-1 text-[0.75rem] leading-snug text-oh-mute">
          <summary className="cursor-pointer list-none text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute/80 underline decoration-oh-stone underline-offset-4 hover:text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember [&::-webkit-details-marker]:hidden">
            {why.labels.open}
          </summary>
          <p className="m-0 mt-2">{why.text}</p>
          {why.registryKeys && why.registryKeys.length > 0 ? (
            <p className="m-0 mt-1 flex flex-wrap gap-x-2 gap-y-1">
              <span className="text-oh-mute/80">{why.labels.register}</span>
              {why.registryKeys.map((k) => (
                <a key={k} href={registryHref(why.locale, k)} className="underline decoration-oh-stone underline-offset-4 hover:text-oh-cream">
                  {k}
                </a>
              ))}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
