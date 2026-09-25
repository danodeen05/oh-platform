"use client";

import { SCENARIO_KEYS, type ScenarioKey } from "@oh/plan-model";

interface Props {
  value: ScenarioKey;
  custom: boolean;
  labels: Record<ScenarioKey | "custom", string>;
  onChange: (key: ScenarioKey) => void;
}

/** Segmented control. "Custom" lights up when any lever has left its preset. */
export function ScenarioToggle({ value, custom, labels, onChange }: Props) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg border border-oh-stone bg-oh-ink p-1">
      {SCENARIO_KEYS.map((k) => {
        const active = !custom && k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(k)}
            className={[
              "rounded-md px-3 py-1.5 text-[0.8rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember",
              active ? "bg-oh-charcoal text-oh-cream" : "bg-transparent text-oh-mute hover:text-oh-cream",
            ].join(" ")}
          >
            {labels[k]}
          </button>
        );
      })}
      <span
        role="radio"
        aria-checked={custom}
        className={["rounded-md px-3 py-1.5 text-[0.8rem]", custom ? "bg-oh-charcoal text-oh-gold" : "text-oh-mute"].join(" ")}
      >
        {labels.custom}
      </span>
    </div>
  );
}
