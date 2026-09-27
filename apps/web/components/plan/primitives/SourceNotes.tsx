import { registryAnchor } from "@oh/plan-model";

export interface SourceNote {
  /** Register key, e.g. "unit.avgBowlPrice". Links to that row on the Model integrity page. */
  registryKey?: string;
  /** Short label for the link; defaults to the key. */
  label?: string;
  /** Free text when the source is not a register row (a public benchmark, a decision). */
  text?: string;
}

interface Props {
  locale: string;
  /** Leading word, e.g. "Sources". */
  title: string;
  notes: readonly SourceNote[];
  className?: string;
}

/** Deep link to a register row: plain `#a-...` token, which survives the print route and the palette. */
export function registryHref(locale: string, registryKey: string): string {
  return `/${locale}/plan/integrity#${registryAnchor(registryKey)}`;
}

/**
 * A small source line under a figure or table: each note is a link to the
 * assumption's row in the register, or plain text for a benchmark. Hook-free
 * so print and server components can use it (spec 3.4: every number traceable).
 */
export function SourceNotes({ locale, title, notes, className }: Props) {
  if (notes.length === 0) return null;
  return (
    <p className={["m-0 mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.72rem] leading-snug text-oh-mute", className ?? ""].join(" ")}>
      <span className="uppercase tracking-[0.14em] text-oh-mute/80">{title}</span>
      {notes.map((n, i) => {
        const sep = i < notes.length - 1 ? <span aria-hidden="true">·</span> : null;
        if (n.registryKey) {
          return (
            <span key={`${n.registryKey}-${i}`} className="inline-flex items-baseline gap-x-2">
              <a href={registryHref(locale, n.registryKey)} className="underline decoration-oh-stone underline-offset-4 hover:text-oh-cream">
                {n.label ?? n.registryKey}
              </a>
              {sep}
            </span>
          );
        }
        return (
          <span key={`t-${i}`} className="inline-flex items-baseline gap-x-2">
            <span>{n.text ?? n.label}</span>
            {sep}
          </span>
        );
      })}
    </p>
  );
}
