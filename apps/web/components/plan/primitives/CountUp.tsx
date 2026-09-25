"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { fmtCompact, fmtCurrency, fmtInteger, fmtMultiple, fmtPercent, fmtYears, type Currency } from "@oh/plan-model";

export type CountUpKind = "currency" | "compact" | "percent" | "integer" | "multiple" | "years";

interface Props {
  value: number;
  kind: CountUpKind;
  locale?: string;
  currency?: Currency;
  fractionDigits?: number;
  /** Duration in ms. Default 900. */
  duration?: number;
  className?: string;
}

function format(v: number, p: Props): string {
  const locale = p.locale ?? "en-US";
  switch (p.kind) {
    case "currency":
      return fmtCurrency(v, { locale, ...(p.currency ? { currency: p.currency } : {}), ...(p.fractionDigits !== undefined ? { fractionDigits: p.fractionDigits } : {}) });
    case "compact":
      return fmtCompact(v, { locale, ...(p.currency ? { currency: p.currency } : {}), ...(p.fractionDigits !== undefined ? { fractionDigits: p.fractionDigits } : {}) });
    case "percent":
      return fmtPercent(v, locale, p.fractionDigits ?? 1);
    case "multiple":
      return fmtMultiple(v, locale, p.fractionDigits ?? 1);
    case "integer":
      return fmtInteger(v, locale);
    case "years":
      return fmtYears(v, locale, p.fractionDigits ?? 1);
  }
}

/** Figures already animated in this page session; re-entering a section does not replay them (spec 3.3). */
const seen = new Set<string>();

/**
 * Counts from zero to `value` once, on first view, then tracks later value
 * changes instantly. A figure seen earlier in the session (same kind and
 * value) renders final immediately, as does reduced motion. Tabular numerals
 * stop the jitter.
 */
export function CountUp(props: Props) {
  const { value, duration = 900 } = props;
  const reduce = useReducedMotion();
  const key = `${props.kind}:${value}`;
  const skip = reduce === true || seen.has(key);
  const [shown, setShown] = useState<number>(skip ? value : 0);
  const done = useRef(skip);

  useEffect(() => {
    if (done.current) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        done.current = true;
        seen.add(key);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, key]);

  return (
    <span className={["tabular-nums", props.className ?? ""].join(" ")} aria-label={format(value, props)}>
      {format(shown, props)}
    </span>
  );
}
