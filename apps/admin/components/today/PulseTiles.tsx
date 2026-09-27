import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { money } from "@/lib/format";
import type { TodayPayload } from "@/lib/today";

const grid = "grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4";

/** Today at a glance. Sales shows only when the API sent it (owner). */
export function PulseTiles({ today }: { today: TodayPayload | null }) {
  if (!today) {
    return (
      <div role="status" className={grid}>
        <span className="sr-only">Loading</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-card border border-oh-stone/15 bg-oh-cream p-4 shadow-card">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-12" />
          </div>
        ))}
      </div>
    );
  }
  const calls = today.openPodCalls;
  return (
    <div className={grid}>
      <StatTile label="Orders today" value={today.ordersToday} hint="Since midnight" />
      <StatTile label="In the dining room" value={today.activeDiners} hint="Orders in progress" />
      <StatTile label="Pod calls" value={calls} tone={calls > 0 ? "alert" : "neutral"} href="/kitchen"
        hint={calls > 0 ? "Waiting on the floor" : "None waiting"} />
      {today.salesCents !== undefined && <StatTile label="Sales today" value={money(today.salesCents)} hint="Paid orders" />}
    </div>
  );
}
