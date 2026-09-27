"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { Overage, OverageInvoiceResult } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export default function OverageTab({ eventId, pricePerBowlCents }: { eventId: string; pricePerBowlCents: number }) {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource(`catering-overage:${eventId}`, (signal) => api<Overage>(`/admin/catering/events/${eventId}/overage`, { signal }));
  const [charging, setCharging] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<OverageInvoiceResult | null>(null);
  const overage = res.data;

  if (res.error && !overage) return <ErrorCard message="Couldn't load overage." onRetry={res.reload} />;
  if (!overage) return <SkeletonList rows={3} />;

  async function charge() {
    const ok = await ask({
      title: `Charge client for ${overage!.overageBowls} extra bowl${overage!.overageBowls !== 1 ? "s" : ""} (${money(overage!.overageAmountCents)})?`,
      body: "This creates a Stripe invoice.", confirmLabel: "Charge",
    });
    if (!ok) return;
    setCharging(true);
    try {
      const data = await api<OverageInvoiceResult>(`/admin/catering/events/${eventId}/overage-invoice`, { method: "POST" });
      setInvoiceResult(data);
    } catch (e) {
      show({ message: `Couldn't create the invoice. ${errorText(e)}`, tone: "alert" });
    } finally {
      setCharging(false);
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Bowls booked" value={overage.bookedBowls} />
        <StatTile label="Bowls ordered" value={overage.orderedCount} />
        <StatTile label="Overage bowls" value={overage.overageBowls} tone={overage.overageBowls > 0 ? "pending" : "neutral"} />
        {overage.overageBowls > 0 && (
          <StatTile label="Overage amount" value={money(overage.overageAmountCents)} hint={`${overage.overageBowls} x ${money(pricePerBowlCents)}`} tone="pending" />
        )}
      </div>

      {invoiceResult && (
        <Card>
          <p className="font-semibold text-oh-olive">Overage invoice sent</p>
          <p className="mt-1 text-[15px] text-oh-charcoal">Status: <span className="font-semibold">{invoiceResult.charge.status}</span></p>
          {invoiceResult.invoice.url && (
            <a href={invoiceResult.invoice.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-oh-ember-deep hover:underline">View Stripe invoice</a>
          )}
        </Card>
      )}

      {overage.overageBowls > 0 && !invoiceResult && (
        <Card>
          <p className="font-semibold text-oh-clay">Overage detected</p>
          <p className="mt-1 text-[15px] text-oh-charcoal">
            {overage.overageBowls} extra bowl{overage.overageBowls !== 1 ? "s" : ""} were ordered beyond the committed amount. Charge the client {money(overage.overageAmountCents)}.
          </p>
          <Button variant="primary" className="mt-3" onClick={charge} loading={charging}>
            Charge client for {overage.overageBowls} extra bowl{overage.overageBowls !== 1 ? "s" : ""} ({money(overage.overageAmountCents)})
          </Button>
        </Card>
      )}

      {overage.overageBowls === 0 && (
        <Card><p className="text-[15px] text-oh-olive">No overage. Orders are within the committed amount.</p></Card>
      )}
    </div>
  );
}
