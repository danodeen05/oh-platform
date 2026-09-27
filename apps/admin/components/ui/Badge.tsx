import type { ReactNode } from "react";

const TONE = {
  neutral: "bg-oh-stone/10 text-oh-stone [--dot:var(--color-oh-ash)]",
  good: "bg-oh-olive/15 text-oh-olive [--dot:var(--color-oh-olive)]",
  pending: "bg-oh-gold/20 text-oh-clay [--dot:var(--color-oh-gold)]",
  alert: "bg-oh-ember/12 text-oh-ember-deep [--dot:var(--color-oh-ember)]",
  info: "bg-oh-ink/10 text-oh-ink [--dot:var(--color-oh-ink)]",
} as const;
export type BadgeTone = keyof typeof TONE;

/** Status is always a word plus a dot, never colour alone. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${TONE[tone]}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--dot)" aria-hidden="true" />
      {children}
    </span>
  );
}
