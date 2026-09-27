"use client";
import Link from "next/link";
import { useState } from "react";
import { BlackoutManager } from "./_components/BlackoutManager";
import { BookingCalendar } from "./_components/BookingCalendar";
import { EventSheet } from "./_components/EventSheet";
import StatusBadge from "./_components/StatusBadge";
import { OrderNowSwitch } from "@/components/shell/OrderNowSwitch";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { slotLabel, type CateringAnalytics, type CateringEvent, type CateringSlot } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");
type View = "list" | "calendar" | "blocked";
const VIEW_OPTIONS: SegmentOption<View>[] = [
  { value: "list", label: "List" }, { value: "calendar", label: "Calendar" }, { value: "blocked", label: "Blocked" },
];

export default function CateringPage() {
  const { show } = useToast();
  const ask = useConfirm();
  const [view, setView] = useState<View>("list");
  const [sheet, setSheet] = useState<{ event: CateringEvent | null; date?: string; slot?: CateringSlot } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const res = useResource("catering-events", (signal) => api<CateringEvent[]>("/admin/catering/events", { signal }));
  const analyticsRes = useResource("catering-analytics", (signal) => api<CateringAnalytics>("/admin/catering/analytics", { signal }));
  const events = res.data;
  const a = analyticsRes.data;

  async function remove(event: CateringEvent) {
    const ok = await ask({
      title: `Delete ${event.clientCompany}?`,
      body: "Permanently deletes this event and ALL related data (booking, RSVPs, orders, survey). This cannot be undone.",
      confirmLabel: "Delete", tone: "danger",
    });
    if (!ok) return;
    setDeletingId(event.id);
    try {
      await api(`/admin/catering/events/${event.id}`, { method: "DELETE" });
      await Promise.all([res.reload(), analyticsRes.reload()]);
      show({ message: `${event.clientCompany} deleted`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setDeletingId(null);
    }
  }
  function openCreate() { setSheet({ event: null }); }
  function openFromCalendar(date: string, slot: CateringSlot) { setSheet({ event: null, date, slot }); }

  const COLUMNS: Column<CateringEvent>[] = [
    { key: "company", label: "Company", render: (e) => (
      <>
        <Link href={`/catering/${e.id}`} className="font-semibold text-oh-charcoal underline-offset-4 hover:underline">{e.clientCompany}</Link>
        {e.contactName && <span className="block text-sm text-oh-stone/60">{e.contactName}</span>}
      </>
    ) },
    { key: "event", label: "Event", render: (e) => e.eventName || <span className="text-oh-stone/50">Not set</span> },
    { key: "date", label: "Date", render: (e) => shortDate(e.eventDate) },
    { key: "slot", label: "Slot", render: (e) => <Badge tone={e.slot === "LUNCH" ? "pending" : "info"}>{slotLabel(e.slot)}</Badge> },
    { key: "status", label: "Status", render: (e) => <StatusBadge status={e.status} /> },
    { key: "bowls", label: "Bowls", align: "right", render: (e) => (
      <span className="tabular-nums"><span className={e.bookedBowls > 0 ? "font-semibold text-oh-olive" : "text-oh-stone/50"}>{e.bookedBowls}</span> / {e.minimumBowls} min</span>
    ) },
    { key: "actions", label: "Actions", render: (e) => (
      <span className="flex justify-end gap-1.5">
        <Button size="sm" variant="danger" disabled={deletingId === e.id} onClick={() => remove(e)}>{deletingId === e.id ? "Deleting" : "Delete"}</Button>
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title="Catering" actions={<Button variant="primary" icon="plus" onClick={openCreate}>New event</Button>} />
      <div className="space-y-4">
        <OrderNowSwitch variant="card" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Events" value={a ? a.eventsCreated : "…"} />
          <StatTile label="Bookings" value={a ? a.bookingsConfirmed : "…"} hint={a ? `${a.bookingConversionPct.toFixed(1)}% · ${a.bookingsStarted} started` : undefined} />
          <StatTile label="RSVPs" value={a ? a.rsvpCount : "…"} hint={a ? `${a.rsvpPerEvent.toFixed(1)} per event` : undefined} />
          <StatTile label="Order conversion" value={a ? `${a.orderConversionPct.toFixed(1)}%` : "…"} hint={a ? `${a.attendeeOrders} orders` : undefined} />
          <StatTile label="Events booked" value={events ? events.filter((e) => Boolean(e.booking)).length : "…"} />
        </div>

        <SegmentedControl<View> label="View" value={view} onChange={setView} options={VIEW_OPTIONS} />

        {view === "list" && (
          res.error && !events ? (
            <ErrorCard message="Couldn't load catering events." onRetry={res.reload} />
          ) : !events ? (
            <SkeletonList rows={5} />
          ) : (
            <DataList rows={events} rowKey={(e) => e.id} columns={COLUMNS}
              empty={<EmptyState icon="calendar" title="No catering events yet" body="Create your first one." action={<Button variant="primary" icon="plus" onClick={openCreate}>New event</Button>} />}
              renderCard={(e) => (
                <div className="space-y-2.5 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <Link href={`/catering/${e.id}`} className="block font-semibold text-oh-charcoal underline-offset-4 hover:underline">{e.clientCompany}</Link>
                      {e.contactName && <span className="block text-sm text-oh-stone/60">{e.contactName}</span>}
                    </span>
                    <StatusBadge status={e.status} />
                  </div>
                  {e.eventName && <p className="text-sm text-oh-stone/70">{e.eventName}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-oh-stone">
                    <Badge tone={e.slot === "LUNCH" ? "pending" : "info"}>{slotLabel(e.slot)}</Badge>
                    <span>{shortDate(e.eventDate)}</span>
                    <span className="tabular-nums"><span className={e.bookedBowls > 0 ? "font-semibold text-oh-olive" : "text-oh-stone/50"}>{e.bookedBowls}</span> / {e.minimumBowls} min</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Link href={`/catering/${e.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-oh-stone/20 bg-oh-cream text-sm font-semibold text-oh-charcoal hover:bg-oh-linen">View</Link>
                    <Button size="sm" variant="danger" className="flex-1" disabled={deletingId === e.id} onClick={() => remove(e)}>{deletingId === e.id ? "Deleting" : "Delete"}</Button>
                  </div>
                </div>
              )} />
          )
        )}

        {view === "calendar" && (
          <BookingCalendar year={calYear} month={calMonth} onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }} onCreateWithPrefill={openFromCalendar} />
        )}

        {view === "blocked" && <BlackoutManager />}
      </div>

      {sheet && (
        <EventSheet key={sheet.event?.id ?? "new"} open event={sheet.event} prefillDate={sheet.date} prefillSlot={sheet.slot}
          onClose={() => setSheet(null)}
          onSaved={(saved, created) => {
            setSheet(null);
            res.reload();
            analyticsRes.reload();
            show({ message: created ? `${saved.clientCompany} created` : `${saved.clientCompany} saved`, tone: "good" });
          }} />
      )}
    </>
  );
}
