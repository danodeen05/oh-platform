import Link from "next/link";
import type { ReactNode } from "react";

const TONE = { neutral: "text-oh-charcoal", good: "text-oh-olive", pending: "text-oh-clay", alert: "text-oh-ember-deep" } as const;
export type StatTone = keyof typeof TONE;

export function StatTile({ label, value, hint, tone = "neutral", href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: StatTone; href?: string }) {
  const body = (
    <div className={`h-full rounded-card border border-oh-stone/15 bg-oh-cream p-4 shadow-card ${href ? "transition-colors hover:border-oh-stone/30 hover:bg-oh-linen/50" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">{label}</div>
      <div className={`mt-2 font-display text-[2rem] leading-none tabular-nums ${TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-2 text-sm text-oh-stone/75">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full rounded-card">{body}</Link> : body;
}
