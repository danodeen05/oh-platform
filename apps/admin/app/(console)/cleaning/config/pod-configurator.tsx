"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  canLinkDual, dualPodCount, normalizeSeats, partnerNumber, podName, selectionLabel, singlePodCount, sortByNumber, toggleSelection, type Seat,
} from "@/lib/seats";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function PodConfigurator({ locationId }: { locationId: string }) {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource(`seats:${locationId}`, (signal) => api<unknown>(`/locations/${locationId}/seats`, { signal }).then(normalizeSeats));
  const [selected, setSelected] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  useEffect(() => { setSelected([]); }, [locationId]);

  const seats = res.data?.seats;

  function tap(seat: Seat) {
    if (seat.podType === "DUAL") return;
    setSelected((sel) => toggleSelection(sel, seat.id));
  }

  async function linkDual() {
    if (!seats) return;
    const check = canLinkDual(seats, selected);
    if (check.ok === false) { show({ message: check.reason, tone: "alert" }); return; }
    setLinking(true);
    try {
      await api("/seats/link-dual", { method: "POST", body: { seatId1: selected[0], seatId2: selected[1] } });
      setSelected([]);
      res.reload();
      show({ message: "Pods linked as a dual pod.", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setLinking(false);
    }
  }

  async function unlinkDual(seat: Seat) {
    const ok = await ask({ title: `Unlink pod ${podName(seat)}?`, body: "This pod and its partner go back to seating single diners.", confirmLabel: "Unlink", tone: "danger" });
    if (!ok) return;
    setUnlinkingId(seat.id);
    try {
      await api("/seats/unlink-dual", { method: "POST", body: { seatId: seat.id } });
      res.reload();
      show({ message: `Pod ${podName(seat)} unlinked.`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setUnlinkingId(null);
    }
  }

  if (res.error && !seats) return <ErrorCard message="Couldn't load pods." onRetry={res.reload} />;
  if (!seats) return <SkeletonList rows={4} />;

  const sorted = sortByNumber(seats);
  const label = selectionLabel(seats, selected);
  const linkCheck = canLinkDual(seats, selected);

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Dual pods" value={dualPodCount(seats)} />
        <StatTile label="Single pods" value={singlePodCount(seats)} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="seat" title="No pods configured" body="This location has no pods yet." />
      ) : (
        <div className="grid grid-cols-4 gap-2.5 lg:grid-cols-8">
          {sorted.map((seat) => {
            const isDual = seat.podType === "DUAL";
            const isSelected = selected.includes(seat.id);
            const partner = isDual ? partnerNumber(seats, seat) : null;
            const tileCls = `relative flex min-h-[76px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-2 text-center transition-colors ${
              isSelected ? "border-oh-ember-deep bg-oh-ember/10" : isDual ? "border-oh-olive/60 bg-oh-olive/10" : "border-oh-stone/20 bg-oh-cream hover:border-oh-stone/40"
            }`;
            const badge = isDual && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-oh-olive text-xs font-bold text-oh-cream">2</span>
            );
            const numberEl = <span className="font-display text-xl leading-none text-oh-charcoal tabular-nums">{podName(seat)}</span>;
            const typeEl = <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-oh-stone/70">{isDual ? `Dual with ${partner ?? "?"}` : "Single"}</span>;

            // A dual pod's tile isn't tappable to select (only its own Unlink button is),
            // so it renders as a div with a real nested button instead of a button-in-button.
            if (isDual) {
              return (
                <div key={seat.id} className={tileCls}>
                  {badge}
                  {numberEl}
                  {typeEl}
                  <button type="button" onClick={() => unlinkDual(seat)} disabled={unlinkingId === seat.id} aria-label={`Unlink pod ${podName(seat)}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 text-[11px] font-semibold text-oh-ember-deep hover:bg-oh-ember/10 disabled:opacity-60">
                    {unlinkingId === seat.id ? "..." : "Unlink"}
                  </button>
                </div>
              );
            }
            return (
              <button key={seat.id} type="button" onClick={() => tap(seat)} className={`${tileCls} cursor-pointer`}>
                {numberEl}
                {typeEl}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm text-oh-stone/70">
        <Badge tone="neutral">Single pod</Badge>
        <Badge tone="good">Dual pod</Badge>
        <Badge tone="alert">Selected</Badge>
      </div>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 px-4 lg:sticky lg:bottom-4 lg:inset-x-auto lg:px-0">
          <div className="mx-auto flex max-w-xl flex-col gap-2.5 rounded-card bg-oh-charcoal px-4 py-3 text-oh-cream shadow-[0_8px_30px_rgb(28_27_25/0.3)] sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 text-[15px] font-medium">{label}</span>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 text-oh-cream hover:bg-oh-cream/10 sm:flex-none" onClick={() => setSelected([])}>Clear</Button>
              <Button variant="primary" icon="check" className="flex-1 sm:flex-none" disabled={!linkCheck.ok || linking} loading={linking} onClick={linkDual}>Link as dual pod</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
