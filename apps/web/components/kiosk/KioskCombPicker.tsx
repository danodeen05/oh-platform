"use client";

/**
 * The kiosk's pod picker on the comb floor plan (Task D12). A landscape
 * CombMap in pick mode; the kiosk page around it keeps its own look
 * (.legacy-ui) and flow. Taps come back as seat ids through `podPick`.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CombMap, type CombMapLabels } from "@/components/site/floor-plan/CombMap";
import type { CombLayoutKey, MapSeat } from "@/components/site/floor-plan/useSeats";
import { podPick, seatById, seatsForPick } from "@/lib/kiosk/comb-pick";

export interface KioskCombPickerProps {
  layoutKey: CombLayoutKey;
  seats: MapSeat[];
  selectedPodId?: string | null;
  /** Pods other guests in this party already chose. */
  takenPodIds?: readonly string[];
  canSelectDualPod: boolean;
  /** A seat id, or "" to clear. */
  onSelectPod: (id: string) => void;
  onDualBlocked: () => void;
  /** Tests pass labels directly; the kiosk reads the `combMap` namespace. */
  labels?: CombMapLabels;
}

export function KioskCombPicker(props: KioskCombPickerProps) {
  const t = useTranslations();
  // On the touch kiosk the first tap on a small pod zooms its row, so the hint says so.
  const tapHint = t("kiosk.orderFlow.tapRowThenPod");
  const labels = props.labels ?? { ...(t.raw("combMap") as CombMapLabels), hintTapRow: tapHint, hintTapPod: tapHint };
  return <KioskCombPickerView {...props} labels={labels} />;
}

/** No next-intl dependency, for tests. */
export function KioskCombPickerView({ layoutKey, seats, selectedPodId, takenPodIds = [], canSelectDualPod, onSelectPod, onDualBlocked, labels }: KioskCombPickerProps & { labels: CombMapLabels }) {
  const shown = useMemo(() => seatsForPick(seats, takenPodIds, selectedPodId), [seats, takenPodIds, selectedPodId]);
  const selected = seatById(shown, selectedPodId)?.label ?? null;
  return (
    <CombMap
      layoutKey={layoutKey}
      mode="pick"
      orientation="landscape"
      tone="linen"
      labels={labels}
      seats={shown}
      selected={selected}
      partySize={canSelectDualPod ? 2 : 1}
      className="mx-auto"
      onSelect={(label) => {
        const pick = podPick(shown, label, { selectedId: selectedPodId, canSelectDual: canSelectDualPod });
        if (pick.kind === "select") onSelectPod(pick.id);
        else if (pick.kind === "clear") onSelectPod("");
        else if (pick.kind === "dual-blocked") onDualBlocked();
      }}
    />
  );
}
