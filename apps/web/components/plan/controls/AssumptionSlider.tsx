"use client";

import { useId } from "react";
import { LEVER_BOUNDS, type LeverKey } from "@oh/plan-model";

interface Props {
  lever: LeverKey;
  label: string;
  value: number;
  /** Formatted value for the readout and aria-valuetext. */
  display: string;
  /** Preset value; shown as a tick and used to flag a changed lever. */
  baseline: number;
  onChange: (value: number) => void;
  /** Override the engine bounds, e.g. a narrower range for a slider. */
  min?: number;
  max?: number;
  step?: number;
}

/**
 * A native range input styled for the plan: proper slider semantics,
 * aria-valuetext with the formatted figure (spec 7.6), tabular readout, and
 * an ember dot when the value differs from the preset.
 */
export function AssumptionSlider({ lever, label, value, display, baseline, onChange, min, max, step }: Props) {
  const id = useId();
  const b = LEVER_BOUNDS[lever];
  const lo = min ?? b.min;
  const hi = max ?? b.max;
  const st = step ?? b.step;
  const changed = Math.abs(value - baseline) > st / 2;
  const pct = ((value - lo) / (hi - lo)) * 100;
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.78rem] tracking-wide text-oh-mute">
          {changed ? <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-oh-ember align-middle" /> : null}
          {label}
        </label>
        <output htmlFor={id} className="font-display text-[1.05rem] tabular-nums text-oh-cream">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={lo}
        max={hi}
        step={st}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer appearance-none bg-transparent focus:outline-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-oh-cream [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-oh-ember)_var(--plan-range-pct),var(--color-oh-stone)_var(--plan-range-pct))] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-oh-ember)_var(--plan-range-pct),var(--color-oh-stone)_var(--plan-range-pct))] [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-oh-cream focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-oh-ember"
        style={{ ["--plan-range-pct" as string]: `${pct}%` }}
      />
    </div>
  );
}
