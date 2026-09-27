"use client";
import { useLocationFilter } from "@/components/providers/LocationProvider";
import { useRole } from "@/components/providers/RoleProvider";
import { OrderNowSwitch } from "@/components/shell/OrderNowSwitch";
import { AttentionList } from "@/components/today/AttentionList";
import { PulseTiles } from "@/components/today/PulseTiles";
import { QuickActions } from "@/components/today/QuickActions";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { attentionRows, denverDayLabel, type TodayPayload } from "@/lib/today";
import { useResource } from "@/lib/use-resource";

export default function TodayPage() {
  const role = useRole();
  const { locationId, locations } = useLocationFilter();
  const today = useResource(`today:${locationId}`,
    (signal) => api<TodayPayload>("/admin/today", { signal, query: { locationId } }), { refreshMs: 60_000 });

  const place = locationId === "all" ? "All locations" : locations.find((l) => l.id === locationId)?.name;
  const day = denverDayLabel(today.data?.date ?? new Date().toISOString());
  const failed = today.error && !today.data;

  return (
    <>
      <PageHeader title="Today" subtitle={place ? `${day} · ${place}` : day} />
      <div className="space-y-4 lg:space-y-6">
        {failed
          ? <ErrorCard message="Couldn't load today's numbers." onRetry={today.reload} />
          : <PulseTiles today={today.data} />}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
          <div className="lg:col-start-2 lg:row-start-1"><OrderNowSwitch variant="card" /></div>
          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
            {today.data
              ? <AttentionList rows={attentionRows(today.data, role)} />
              : !failed && <SkeletonList rows={3} />}
          </div>
          <div className="lg:col-start-2 lg:row-start-2"><QuickActions /></div>
        </div>
      </div>
    </>
  );
}
