"use client";
import type { ReactNode } from "react";

export type ChipOption<V extends string> = { value: V; label: ReactNode; count?: number };

/** A sideways-scrolling row of single-select pills, each 44px tall. */
export function FilterChips<V extends string>({ options, value, onChange, label, className = "" }: {
  options: ChipOption<V>[]; value: V; onChange: (v: V) => void; label?: string; className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${on
              ? "border-oh-charcoal bg-oh-charcoal text-oh-cream"
              : "border-oh-stone/20 bg-oh-cream text-oh-stone hover:border-oh-stone/40"}`}>
            {o.label}
            {o.count !== undefined && (
              <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums ${on ? "bg-oh-cream/15 text-oh-cream" : "bg-oh-stone/10 text-oh-stone/80"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
