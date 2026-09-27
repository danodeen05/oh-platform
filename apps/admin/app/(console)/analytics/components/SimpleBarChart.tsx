import { Card } from "@/components/ui/Card";

export type BarPoint = { label: string; value: number; formatted?: string };

/** Horizontal bars in a Card. Any overflow (many rows) scrolls inside the card only. */
export function SimpleBarChart({ title, data }: { title: string; data: BarPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card title={title}>
      {data.length === 0 ? (
        <p className="text-[15px] text-oh-stone/60">No data yet</p>
      ) : (
        <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {data.map((d, i) => (
            <div key={`${d.label}-${i}`} className="flex items-center gap-3">
              <span className="w-16 shrink-0 truncate text-sm text-oh-stone/70">{d.label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-oh-linen">
                <span
                  style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} // style-ok: bar width scaled from data
                  className="block h-full rounded-full bg-oh-ember-deep"
                />
              </span>
              <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-oh-charcoal">{d.formatted ?? d.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
