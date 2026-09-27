import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { money } from "@/lib/format";
import { topCodes, usageByScope, type PromoAnalytics as PromoAnalyticsData } from "@/lib/promo";

export function PromoAnalytics({ data }: { data: PromoAnalyticsData }) {
  const byScope = usageByScope(data.promoCodes);
  const top = topCodes(data.promoCodes);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Total usages" value={data.summary.totalUsagesInPeriod} />
        <StatTile label="Total discount" value={money(data.summary.totalDiscountGivenCents)} tone="good" />
        <Card title="Usage by scope" className="col-span-2 lg:col-span-1">
          {byScope.length === 0 ? (
            <p className="text-sm text-oh-stone/60">No usage yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {byScope.map((s) => (
                <li key={s.scope} className="flex justify-between text-[15px]"><span className="text-oh-stone">{s.scope}</span><span className="font-semibold tabular-nums text-oh-charcoal">{s.count}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Top codes" padded={false}>
        {top.length === 0 ? (
          <p className="px-4 py-4 text-sm text-oh-stone/60">No usage yet.</p>
        ) : top.map((c) => (
          <div key={c.code} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
            <span className="font-mono text-[15px] font-semibold text-oh-charcoal">{c.code}</span>
            <span className="flex items-center gap-4 text-sm text-oh-stone">
              <span className="tabular-nums">{c.usageCount} {c.usageCount === 1 ? "use" : "uses"}</span>
              <span className="tabular-nums font-semibold text-oh-charcoal">{money(c.discountGivenCents)}</span>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
