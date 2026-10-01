"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { isSpecialDiet, orderLineLabel, type CookOrder } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

type Stage = { status: string; label: string; action?: { label: string; next: string; arrive?: boolean } };
/** Kitchen stages in order, each with the one action that moves a card forward. PAID uses the admin arrive route (no day check). */
const STAGES: readonly Stage[] = [
  { status: "PAID", label: "Waiting", action: { label: "Check in", next: "QUEUED", arrive: true } },
  { status: "QUEUED", label: "Checked in", action: { label: "Start cooking", next: "PREPPING" } },
  { status: "PREPPING", label: "Cooking", action: { label: "Ready", next: "READY" } },
  { status: "READY", label: "Ready", action: { label: "Served", next: "SERVING" } },
  { status: "SERVING", label: "Served", action: { label: "Done", next: "COMPLETED" } },
  { status: "COMPLETED", label: "Done" },
];

function bowlLines(o: CookOrder) {
  return o.items.map((i) => ({ label: orderLineLabel(i), diet: isSpecialDiet({ items: [i] }) }));
}

function CookCard({ order, stage, busy, onAdvance }: { order: CookOrder; stage: Stage; busy: boolean; onAdvance: () => void }) {
  const lines = bowlLines(order);
  const diet = lines.some((l) => l.diet);
  return (
    <Card className={diet ? "border-oh-ember/50" : ""}>
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <span className="min-w-0 max-w-full break-words text-[15px] font-bold text-oh-charcoal">{order.guestName || order.guest?.name || "Guest"}</span>
        {diet && <Badge tone="alert">Special diet</Badge>}
      </div>
      <ul className="space-y-0.5 text-sm text-oh-stone">
        {lines.map((l, i) => <li key={i} className={l.diet ? "font-semibold text-oh-ember-deep" : ""}>{l.label}</li>)}
      </ul>
      {order.guestNotes ? (
        <p className="break-words text-sm text-oh-stone/70" data-cook-note><span className="font-semibold">Note:</span> {order.guestNotes}</p>
      ) : null}
      {stage.action && (
        <Button variant="primary" className="w-full" loading={busy} onClick={onAdvance}>{stage.action.label}</Button>
      )}
    </div>
    </Card>
  );
}

export default function CookTab({ eventId }: { eventId: string }) {
  const { show } = useToast();
  const res = useResource(`catering-cook:${eventId}`, async (signal) => {
    const rows = await api<CookOrder[]>(`/admin/catering/events/${eventId}/orders`, { signal });
    return (Array.isArray(rows) ? rows : []).filter((o) => o.status !== "CANCELLED");
  }, { refreshMs: 10_000 });
  const [busyId, setBusyId] = useState<string | null>(null);

  if (res.error && !res.data) return <ErrorCard message="Couldn't load the kitchen." onRetry={res.reload} />;
  if (!res.data) return <SkeletonList rows={3} />;
  const orders = res.data;
  const count = (s: string) => orders.filter((o) => o.status === s).length;

  async function advance(order: CookOrder, stage: Stage) {
    const a = stage.action;
    if (!a) return;
    setBusyId(order.id);
    try {
      if (a.arrive) {
        if (!order.orderQrCode) throw new Error("This order has no check-in code.");
        await api(`/admin/catering/orders/${encodeURIComponent(order.orderQrCode)}/arrive`, { method: "POST" });
      } else {
        await api(`/kitchen/orders/${order.id}/status`, { method: "PATCH", body: { status: a.next } });
      }
      res.reload();
    } catch (e) {
      show({ message: `Couldn't update ${order.guestName || order.guest?.name || "the order"}. ${errorText(e)}`, tone: "alert" });
    } finally {
      setBusyId(null);
    }
  }

  if (orders.length === 0) {
    return <div className="rounded-card border border-oh-stone/15 bg-oh-cream shadow-card"><EmptyState icon="flame" title="No bowls yet" body="Orders show up here as guests pick their bowls." /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total bowls" value={orders.length} />
        <StatTile label="Waiting" value={count("PAID")} tone="pending" />
        <StatTile label="Cooking" value={count("PREPPING")} tone="alert" />
        <StatTile label="Ready" value={count("READY")} tone="good" />
      </div>

      <div className="space-y-5 lg:grid lg:grid-cols-6 lg:items-start lg:gap-3 lg:space-y-0">
        {STAGES.map((stage) => {
          const rows = orders.filter((o) => o.status === stage.status);
          return (
            <section key={stage.status} aria-label={stage.label} className={`space-y-2 ${rows.length === 0 ? "hidden lg:block" : ""}`}>
              <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">
                <span>{stage.label}</span><span className="tabular-nums">{rows.length}</span>
              </h3>
              {rows.map((o) => <CookCard key={o.id} order={o} stage={stage} busy={busyId === o.id} onAdvance={() => advance(o, stage)} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
