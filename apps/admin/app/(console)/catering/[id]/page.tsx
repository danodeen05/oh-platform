"use client";
import { use, useState } from "react";
import { EventSheet } from "../_components/EventSheet";
import StatusBadge from "../_components/StatusBadge";
import GuestsTab from "./tabs/GuestsTab";
import OverageTab from "./tabs/OverageTab";
import OrdersTab from "./tabs/OrdersTab";
import OverviewTab from "./tabs/OverviewTab";
import ShoppingTab from "./tabs/ShoppingTab";
import SurveyTab from "./tabs/SurveyTab";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { eventDateLong, slotLabel, type CateringEvent } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/catering", label: "Catering" };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

type TabId = "overview" | "guests" | "orders" | "shopping" | "overage" | "survey";
const TABS: SegmentOption<TabId>[] = [
  { value: "overview", label: "Overview" },
  { value: "guests", label: "Guests" },
  // Task 8: Messages and Cook go here, before Orders.
  { value: "orders", label: "Orders" },
  { value: "shopping", label: "Shopping" },
  { value: "survey", label: "Survey" },
];

export default function CateringEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource(`catering-event:${id}`, (signal) => api<CateringEvent>(`/admin/catering/events/${encodeURIComponent(id)}`, { signal }));
  const event = res.data;
  const [tab, setTab] = useState<TabId>("overview");
  const tabs = TABS.filter((t) => t.value !== "overage" || (event?.pricePerBowlCents ?? 0) > 0);
  const [editOpen, setEditOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [sending, setSending] = useState(false);
  const [logoError, setLogoError] = useState(false);

  if (!event) {
    const missing = res.error === "Event not found";
    return (
      <>
        <PageHeader title="Catering event" back={BACK} />
        {res.error
          ? <ErrorCard message={missing ? "This event doesn't exist." : "Couldn't load this event."} onRetry={missing ? undefined : res.reload} />
          : <div className="space-y-4"><Skeleton className="h-32 rounded-card" /><SkeletonList rows={3} /></div>}
      </>
    );
  }

  async function runEnrichment() {
    setEnriching(true);
    try {
      await api(`/admin/catering/events/${event!.id}/enrich`, { method: "POST" });
      res.reload();
    } catch (e) {
      show({ message: `Couldn't start enrichment. ${errorText(e)}`, tone: "alert" });
    } finally {
      setEnriching(false);
    }
  }

  async function sendInvites() {
    const ok = await ask({ title: "Text all RSVPs the order link and arrival invite now?", confirmLabel: "Send invites" });
    if (!ok) return;
    setSending(true);
    try {
      const data = await api<{ sent: number; total: number; failed: number }>(`/admin/catering/events/${event!.id}/send-invites`, { method: "POST" });
      show({ message: `Invites sent to ${data.sent} of ${data.total}. ${data.failed} failed.`, tone: data.failed ? "alert" : "good" });
    } catch (e) {
      show({ message: `Couldn't send invites. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSending(false);
    }
  }

  const title = event.eventName || event.clientCompany;
  const subline = [
    title !== event.clientCompany ? event.clientCompany : null,
    eventDateLong(event.eventDate),
    slotLabel(event.slot),
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title={title} back={BACK}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {event.logoUrl && !logoError && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.logoUrl} alt="" className="h-6 max-w-16 object-contain" onError={() => setLogoError(true)} />
            )}
            <StatusBadge status={event.status} />
            <span>{subline}</span>
          </span>
        }
        actions={
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {event.status === "PLANNING" && event.clientWebsite && (
              <Button icon="sparkle" onClick={runEnrichment} loading={enriching}>Run AI enrichment</Button>
            )}
            <Button icon="edit" onClick={() => setEditOpen(true)}>Edit event</Button>
            <Button variant="primary" icon="phone" onClick={sendInvites} loading={sending}>Send invites</Button>
          </div>
        } />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 bg-oh-paper/95 px-4 py-2 backdrop-blur-sm lg:-mx-8 lg:px-8">
        <SegmentedControl<TabId> label="Section" value={tab} onChange={setTab} options={tabs} scroll className="lg:max-w-xl" />
      </div>

      {tab === "overview" && <OverviewTab event={event} onRefresh={res.reload} />}
      {tab === "guests" && <GuestsTab eventId={event.id} />}
      {tab === "orders" && <OrdersTab eventId={event.id} minimumBowls={event.minimumBowls} />}
      {tab === "shopping" && <ShoppingTab eventId={event.id} />}
      {tab === "overage" && <OverageTab eventId={event.id} pricePerBowlCents={event.pricePerBowlCents} />}
      {tab === "survey" && <SurveyTab eventId={event.id} />}

      {editOpen && (
        <EventSheet open event={event} onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); res.reload(); show({ message: "Event saved", tone: "good" }); }} />
      )}
    </>
  );
}
