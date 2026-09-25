import { CountUp, type CountUpKind } from "./CountUp";
import type { Currency } from "@oh/plan-model";

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
}

/** One figure, labeled. Every number passes through the engine's formatters. */
export function StatCard({ label, value, kind, locale, currency, fractionDigits, note, accent = false }: Props) {
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
    </div>
  );
}
