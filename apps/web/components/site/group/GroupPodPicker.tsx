"use client";

/**
 * Task D11: the host picks a pod for each member on the CombMap (pick
 * mode, duos lit while two or more members still need a pod). Choose a
 * person, then a pod; a duo half seats the next person at the other half.
 * Pods another member holds read as reserved. Nothing is claimed here: the
 * picks travel to the group payment page, and the API claims each pod
 * race-safe after payment (POST /group-orders/:code/complete, falling back
 * to the next best pod when one was taken meanwhile).
 */
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { CombMap, type CombMapLabels } from "@/components/site/floor-plan/CombMap";
import type { CombLayoutKey, MapSeat } from "@/components/site/floor-plan/useSeats";
import { Icon } from "@/components/site/icons/Icon";
import { pickPod, pickRest, seatsForMember, type Picks } from "@/lib/site/group";

export interface PickerMember {
  orderId: string;
  name: string;
}

export function GroupPodPicker({
  layoutKey,
  seats,
  members,
  picks,
  active,
  onChange,
}: {
  layoutKey: CombLayoutKey;
  seats: MapSeat[];
  members: PickerMember[];
  picks: Picks;
  active: string | null;
  onChange: (next: { picks: Picks; active: string | null }) => void;
}) {
  const t = useTranslations();
  const tp = useTranslations("groupLobby.pods");
  const labels = t.raw("combMap") as CombMapLabels;
  const ids = useMemo(() => members.map((m) => m.orderId), [members]);
  const current = active ?? ids[0] ?? null;
  const shown = useMemo(() => seatsForMember(seats, picks, current), [seats, picks, current]);
  const unpicked = ids.filter((id) => !picks[id]).length;
  const free = seats.filter((s) => s.status === "AVAILABLE").length;

  return (
    <div data-group-picker data-ready={seats.length > 0 ? "true" : "false"} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-8">
      <div className="min-w-0">
        <CombMap
          layoutKey={layoutKey}
          mode="pick"
          tone="night"
          labels={labels}
          seats={shown}
          selected={current ? picks[current] ?? null : null}
          partySize={unpicked >= 2 ? 2 : 1}
          onSelect={(label) => {
            if (!current) return;
            onChange(pickPod(seats, ids, picks, current, label));
          }}
        />
        <p className="m-0 mt-3 text-sm text-oh-mute">{tp("free", { free, total: seats.length })}</p>
      </div>

      <div className="min-w-0">
        <p id="group-pick-members" className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">
          {tp("members")}
        </p>
        <div role="radiogroup" aria-labelledby="group-pick-members" className="mt-3 grid gap-2">
          {members.map((m) => {
            const on = m.orderId === current;
            const pod = picks[m.orderId];
            return (
                <button
                  key={m.orderId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ picks, active: m.orderId })}
                  className={`flex min-h-14 w-full cursor-pointer appearance-none items-center justify-between gap-3 rounded-2xl border px-4 text-left font-[inherit] text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream ${
                    on ? "border-oh-ember-light bg-oh-ember-deep/20 text-oh-cream" : "border-oh-stone bg-oh-ink text-oh-cream/85 hover:border-oh-cream/40"
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">{m.name}</span>
                  <span data-member-pod={m.orderId} className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${pod ? "bg-oh-gold text-oh-charcoal" : "text-oh-cream/70"}`}>
                    {pod ?? tp("none")}
                  </span>
                </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-pick-rest
            disabled={unpicked === 0 || free === 0}
            onClick={() => onChange({ picks: pickRest(seats, ids, picks), active: current })}
            className="inline-flex min-h-11 cursor-pointer appearance-none items-center gap-2 rounded-full border border-oh-cream/35 bg-transparent px-4 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-default disabled:opacity-50"
          >
            <Icon name="pod" size={18} />
            {tp("pickRest")}
          </button>
          {Object.keys(picks).length > 0 ? (
            <button
              type="button"
              onClick={() => onChange({ picks: {}, active: ids[0] ?? null })}
              className="inline-flex min-h-11 cursor-pointer appearance-none items-center rounded-full border-0 bg-transparent px-3 font-[inherit] text-base text-oh-cream/70 underline decoration-oh-cream/30 underline-offset-4 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
            >
              {tp("clear")}
            </button>
          ) : null}
        </div>
        <p className="m-0 mt-4 text-sm text-oh-mute">{tp("fillNote")}</p>
      </div>
    </div>
  );
}
