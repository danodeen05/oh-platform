"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "./theme";

export interface WaterfallStep {
  key: string;
  label: string;
  /** Positive for revenue and result bars; negative for costs. */
  amount: number;
  kind: "total" | "cost" | "result";
}

interface Props {
  steps: readonly WaterfallStep[];
  format: (value: number) => string;
  height?: number;
}

/**
 * Revenue-to-EBITDA waterfall: a transparent base bar stacks under each
 * visible bar so costs hang from the running total. Colors: ember for
 * revenue, clay for costs, olive for a positive result, ember for a loss.
 */
export function Waterfall({ steps, format, height = 320 }: Props) {
  let running = 0;
  const rows = steps.map((s) => {
    if (s.kind === "total") {
      running = s.amount;
      return { ...s, base: 0, size: s.amount, top: s.amount };
    }
    if (s.kind === "cost") {
      const top = running;
      running += s.amount;
      return { ...s, base: Math.max(0, running), size: Math.abs(s.amount), top };
    }
    return { ...s, base: Math.min(0, s.amount), size: Math.abs(s.amount), top: s.amount };
  });
  const color = (r: (typeof rows)[number]): string => (r.kind === "total" ? CHART.ember : r.kind === "cost" ? CHART.clay : r.amount >= 0 ? CHART.olive : CHART.ember);
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={steps.map((s) => `${s.label} ${format(s.amount)}`).join(", ")}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 8, left: 8 }} barCategoryGap="22%">
          <XAxis dataKey="label" tick={{ fill: CHART.mute, fontSize: 11 }} axisLine={{ stroke: CHART.stone }} tickLine={false} interval={0} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            cursor={{ fill: "rgba(242,237,228,0.04)" }}
            contentStyle={{ background: CHART.ink, border: `1px solid ${CHART.stone}`, borderRadius: 6, color: CHART.cream, fontSize: 12 }}
            itemStyle={{ color: CHART.cream }}
            labelStyle={{ color: CHART.mute }}
            formatter={(_v, _n, item) => [format((item.payload as { amount: number }).amount), ""]}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="size" stackId="w" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.key} fill={color(r)} />
            ))}
            <LabelList dataKey="amount" position="top" formatter={(v: unknown) => format(Number(v))} style={{ fill: CHART.cream, fontSize: 11, fontVariantNumeric: "tabular-nums" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
