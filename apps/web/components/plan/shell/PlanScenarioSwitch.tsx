"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SCENARIO_KEYS, type ScenarioKey } from "@oh/plan-model";

interface Props {
  /** The scenario every server page rendered with on this request. */
  scenario: ScenarioKey;
  /** The access code's default; shown as a hint when the reader has moved off it. */
  home: ScenarioKey;
  labels: { group: string; reset: string } & Record<ScenarioKey, string>;
}

/**
 * Global scenario switch in the header. Posts the choice to the scenario
 * route (which sets the `oh_plan_scn` cookie) and refreshes the server tree,
 * so every section, the summary, and the print route show the same case.
 * Radio semantics: one group, arrow keys move between cases.
 */
export function PlanScenarioSwitch({ scenario, home, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<ScenarioKey>(scenario);

  const choose = (next: ScenarioKey): void => {
    if (next === current || pending) return;
    setCurrent(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plan/scenario", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: next }),
        });
        if (!res.ok) throw new Error(String(res.status));
        router.refresh();
      } catch {
        setCurrent(current);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label={labels.group} aria-busy={pending || undefined} className="inline-flex rounded-md border border-oh-stone bg-oh-charcoal p-[2px]">
        {SCENARIO_KEYS.map((key) => {
          const active = key === current;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => choose(key)}
              onKeyDown={(e) => {
                const i = SCENARIO_KEYS.indexOf(current);
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  choose(SCENARIO_KEYS[(i + 1) % SCENARIO_KEYS.length]!);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  choose(SCENARIO_KEYS[(i - 1 + SCENARIO_KEYS.length) % SCENARIO_KEYS.length]!);
                }
              }}
              className={[
                "rounded-[4px] px-2 py-1 text-[0.72rem] leading-none tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember",
                active ? "bg-oh-ink text-oh-cream" : "bg-transparent text-oh-mute hover:text-oh-cream",
                pending ? "opacity-70" : "",
              ].join(" ")}
            >
              {labels[key]}
            </button>
          );
        })}
      </div>
      {current !== home ? (
        <button type="button" onClick={() => choose(home)} className="hidden bg-transparent text-[0.68rem] text-oh-mute underline decoration-oh-stone underline-offset-4 hover:text-oh-cream xl:inline">
          {labels.reset}
        </button>
      ) : null}
    </div>
  );
}
