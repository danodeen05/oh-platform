"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export type SegmentOption<V extends string> = { value: V; label: ReactNode; href?: string };

type Props<V extends string> = {
  options: SegmentOption<V>[];
  value: V;
  onChange?: (value: V) => void;
  /** Tabs that may not fit: scroll sideways instead of squeezing. */
  scroll?: boolean;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
};

/** Period pickers and tab bars. Renders Links when options carry an href. Add `sticky top-0` via className for tab bars. */
export function SegmentedControl<V extends string>({ options, value, onChange, scroll = false, label, className = "" }: Props<V>) {
  return (
    <div role="group" aria-label={label} className={`${scroll ? "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""} ${className}`}>
      <div className={`flex gap-1 rounded-xl bg-oh-linen p-1 ${scroll ? "w-max min-w-full" : "w-full"}`}>
        {options.map((o) => {
          const active = o.value === value;
          const cls = `flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:-outline-offset-2! ${scroll ? "shrink-0" : "min-w-0 flex-1"} ${active ? "bg-oh-paper text-oh-charcoal shadow-[0_1px_2px_rgb(28_27_25/0.12)]" : "text-oh-stone/70 hover:text-oh-charcoal"}`;
          return o.href ? (
            <Link key={o.value} href={o.href} aria-current={active ? "page" : undefined} className={cls}
              onClick={() => onChange?.(o.value)}>{o.label}</Link>
          ) : (
            <button key={o.value} type="button" aria-current={active ? "true" : undefined} className={cls}
              onClick={() => onChange?.(o.value)}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}
