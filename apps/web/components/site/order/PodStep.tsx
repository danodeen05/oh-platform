"use client";

/**
 * The pod step (Task D5). "Best pod for you" is the default: the order asks
 * for `seat: {best: true}` and the server picks the free pod nearest the
 * entrance when the order is created (there is no preview route, so the
 * label shows on the pay step). "Choose my own" opens the CombMap in pick
 * mode on the live seats, and the order asks for `seat: {label}`.
 *
 * A party of two lights the duo pods that are free as a pair.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
// Task G2b: framer-motion loads on first open.
import { LazySheet as Sheet } from "@/components/site/motion/LazySheet";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { Icon } from "@/components/site/icons/Icon";
import { useSeats, type CombLayoutKey } from "@/components/site/floor-plan/useSeats";
import type { CombMapLabels } from "@/components/site/floor-plan/CombMap";
import { SITE_IMAGES } from "@/lib/site/images";
import type { PodChoice } from "@/lib/site/order-draft";
import { SITE_API_URL } from "@/lib/site/api";
import { CTA_CLASS, Spinner } from "./StepSheet";

// The map loads when the guest asks to choose, not with the step.
const CombMap = dynamic(() => import("@/components/site/floor-plan/CombMap").then((m) => m.CombMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const NIGHT_SHEET =
  "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:max-w-3xl [&_.oh-sheet-panel]:px-4 [&_.oh-sheet-panel]:pb-0";

export interface PodStepProps {
  locationId: string;
  layoutKey: CombLayoutKey | null;
  pod: PodChoice;
  partySize: 1 | 2;
  onPod: (pod: PodChoice) => void;
  onPartySize: (n: 1 | 2) => void;
}

export function PodStep({ locationId, layoutKey, pod, partySize, onPod, onPartySize }: PodStepProps) {
  const t = useTranslations("orderFlow.pod");
  const tRoot = useTranslations();
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(pod.mode === "pick" ? pod.label : null);
  const seats = useSeats(open ? locationId : null, { apiBase: SITE_API_URL, refreshMs: 15_000 });
  const mapKey = seats.layoutKey || layoutKey;
  const free = seats.seats.filter((s) => s.status === "AVAILABLE").length;

  // A picked pod that someone else just took: say so and clear the pick.
  const pendingSeat = pending ? seats.seats.find((s) => s.label === pending) : null;
  const pendingTaken = Boolean(pendingSeat && pendingSeat.status !== "AVAILABLE");
  useEffect(() => {
    if (open) setPending(pod.mode === "pick" ? pod.label : null);
  }, [open, pod]);

  const combLabels = tRoot.raw("combMap") as CombMapLabels;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p id="pod-party" className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
          {t("party")}
        </p>
        <div role="radiogroup" aria-labelledby="pod-party" className="grid grid-cols-2 gap-1 rounded-2xl bg-oh-ink p-1">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={partySize === n}
              data-party={n}
              onClick={() => onPartySize(n)}
              className={`min-h-12 cursor-pointer appearance-none rounded-xl border-0 px-2 font-[inherit] text-[15px] leading-tight transition-colors duration-200 motion-reduce:transition-none ${FOCUS} ${
                partySize === n ? "bg-oh-cream font-semibold text-oh-charcoal" : "bg-transparent text-oh-mute hover:text-oh-cream"
              }`}
            >
              {n === 1 ? t("partyOne") : t("partyTwo")}
            </button>
          ))}
        </div>
        {partySize === 2 ? <p className="m-0 mt-2 text-sm text-oh-mute">{t("partyTwoNote")}</p> : null}
      </div>

      <div role="radiogroup" aria-label={t("title")} className="flex flex-col gap-3">
        <button
          type="button"
          role="radio"
          aria-checked={pod.mode === "best"}
          data-pod-mode="best"
          onClick={() => onPod({ mode: "best" })}
          className={`group flex w-full cursor-pointer appearance-none flex-col overflow-hidden rounded-3xl border p-0 text-left font-[inherit] transition-[border-color] duration-200 motion-reduce:transition-none ${FOCUS} ${
            pod.mode === "best" ? "border-oh-ember-light bg-oh-stone/60" : "border-oh-stone bg-oh-ink hover:border-oh-mute"
          }`}
        >
          <span className="relative block aspect-[16/7] w-full overflow-hidden bg-oh-linen [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
            <SitePicture image="pod-hatch-a" sizes="(min-width: 768px) 640px, 100vw" alt={tRoot(SITE_IMAGES["pod-hatch-a"].alt)} className="block h-full w-full" />
          </span>
          <span className="flex items-start gap-4 px-4 py-4">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-semibold text-oh-cream">{t("best")}</span>
              <span className="text-sm leading-relaxed text-oh-mute">{t("bestNote")}</span>
            </span>
            <Check on={pod.mode === "best"} />
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={pod.mode === "pick"}
          data-pod-mode="pick"
          onClick={() => setOpen(true)}
          className={`flex min-h-16 w-full cursor-pointer appearance-none items-center gap-4 rounded-3xl border px-4 py-4 text-left font-[inherit] transition-[border-color] duration-200 motion-reduce:transition-none ${FOCUS} ${
            pod.mode === "pick" ? "border-oh-ember-light bg-oh-stone/60" : "border-oh-stone bg-oh-ink hover:border-oh-mute"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-stone text-oh-cream">
            <Icon name="pod" size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold text-oh-cream">{pod.mode === "pick" ? t("picked", { label: pod.label }) : t("pick")}</span>
            <span className="text-sm text-oh-mute">{pod.mode === "pick" ? t("change") : t("pickNote")}</span>
          </span>
          <Check on={pod.mode === "pick"} />
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} label={t("sheetTitle")} snapPoints={[0.94]} className={NIGHT_SHEET}>
        <div className={`flex flex-col ${cjk ? "font-cjk" : "font-body"}`}>
          <div className="-mt-2 mb-1 flex items-center justify-between gap-3">
            <h2 className={`${cjk ? "font-display-cjk" : "font-display"} m-0 text-3xl font-normal text-oh-cream`}>{t("sheetTitle")}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`-mr-2 flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream/80 hover:bg-oh-stone/60 hover:text-oh-cream ${FOCUS}`}
            >
              <Icon name="close" size={22} title={t("close")} />
            </button>
          </div>
          <p className="m-0 mb-3 text-sm text-oh-mute" aria-live="polite">
            {seats.status === "ready" ? (free > 0 ? t("freeCount", { count: free }) : t("noPods")) : seats.status === "error" ? t("mapError") : t("loadingMap")}
          </p>
          {mapKey ? (
            <CombMap
              layoutKey={mapKey}
              mode="pick"
              labels={combLabels}
              seats={seats.seats}
              selected={pending}
              onSelect={(label) => setPending(label)}
              partySize={partySize}
              tone="night"
            />
          ) : (
            <MapPlaceholder />
          )}
          <div className="sticky bottom-0 -mx-4 mt-3 border-t border-oh-stone/70 bg-oh-ink/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md">
            {pendingTaken ? <p className="m-0 mb-2 text-sm text-oh-ember-light">{t("taken", { label: pending! })}</p> : null}
            <button
              type="button"
              data-pod-confirm
              disabled={!pending || pendingTaken}
              onClick={() => {
                if (!pending) return;
                onPod({ mode: "pick", label: pending });
                setOpen(false);
              }}
              className={`${CTA_CLASS} w-full`}
            >
              {pending && !pendingTaken ? t("confirm", { label: pending }) : t("confirmNone")}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${on ? "border-oh-ember-light bg-oh-ember-light text-oh-charcoal" : "border-oh-mute"}`}
    >
      {on ? <Icon name="check" size={16} /> : null}
    </span>
  );
}

function MapPlaceholder() {
  return (
    <div className="flex aspect-[3/4] w-full items-center justify-center rounded-3xl bg-oh-charcoal/60 text-oh-mute md:aspect-[16/10]">
      <Spinner />
    </div>
  );
}
