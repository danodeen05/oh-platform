"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { fmtCompact, fmtCurrency, fmtInteger, fmtMultiple, fmtPercent, type Currency } from "@oh/plan-model";

export type CountUpKind = "currency" | "compact" | "percent" | "integer" | "multiple";

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
  }
}

/**
 * Counts from zero to `value` once, on first mount, then tracks later value
 * changes instantly (spec 3.3: count up on first view only). Reduced motion
 * renders the final figure immediately. Tabular numerals stop the jitter.
 */
export function CountUp(props: Props) {
  const { value, duration = 900 } = props;
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number>(reduce ? value : 0);
  const done = useRef(reduce === true);

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
      else done.current = true;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className={["tabular-nums", props.className ?? ""].join(" ")} aria-label={format(value, props)}>
      {format(shown, props)}
    </span>
  );
}
