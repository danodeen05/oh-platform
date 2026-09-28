"use client";

/**
 * The guest's pod (Task D6): the comb label large ("B-07", or the demo's
 * "32"), then what to do there. Before arrival: "I'm at my pod" (the scan
 * step). Checked in: call staff (PodCall), add to my order, and, once the
 * bowl is served with a dessert on the order, "Ready for dessert".
 *
 * Also used, without actions, on the confirmation and scan pages.
 */
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Eyebrow } from "@/components/site/Text";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { Spinner } from "./StepSheet";

export type ActionState = "idle" | "busy" | "done";

export interface PodCardProps {
  label: string;
  /** The line under the label (e.g. "Checked in", or where to go). */
  note?: ReactNode;
  children?: ReactNode;
}

export function PodCard({ label, note, children }: PodCardProps) {
  const t = useTranslations("afterOrder.common");
  const locale = useLocale();
  return (
    <section data-pod-card aria-label={t("podNumber", { label })} className="relative overflow-hidden rounded-[1.75rem] bg-oh-ink px-5 py-5 ring-1 ring-oh-stone">
      {/* The hatch edge of a real pod: a warm bar down the left side. */}
      <span aria-hidden="true" className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-oh-gold/80" />
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-oh-charcoal text-oh-gold">
          <Icon name="pod" size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow locale={locale} className="text-oh-mute">
            {t("yourPod")}
          </Eyebrow>
          <p data-pod-label className="m-0 mt-0.5 font-display text-[2.5rem] leading-none tracking-wide text-oh-cream tabular-nums">
            {label}
          </p>
        </div>
      </div>
      {note ? <div className="mt-3 text-[15px] leading-relaxed text-oh-mute">{note}</div> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export const ACTION_CLASS =
  "flex min-h-12 w-full cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 px-5 py-3 font-[inherit] text-[15px] font-semibold no-underline transition-[background-color,transform,filter] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-default motion-reduce:transition-none motion-reduce:active:scale-100";
export const PRIMARY = `${ACTION_CLASS} bg-oh-ember-deep text-oh-cream hover:brightness-90`;
export const SECONDARY = `${ACTION_CLASS} bg-oh-charcoal text-oh-cream ring-1 ring-inset ring-oh-stone hover:bg-oh-stone/60`;

export function ActionButton({
  icon,
  label,
  doneLabel,
  busyLabel,
  state = "idle",
  onClick,
  tone = "secondary",
  dataAttr,
}: {
  icon: IconName;
  label: string;
  doneLabel?: string;
  busyLabel?: string;
  state?: ActionState;
  onClick: () => void;
  tone?: "primary" | "secondary";
  dataAttr?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state !== "idle"}
      aria-busy={state === "busy" ? "true" : "false"}
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      className={`${tone === "primary" ? PRIMARY : SECONDARY} ${state === "done" ? "!bg-oh-charcoal !text-oh-olive-light" : ""}`}
    >
      {state === "busy" ? <Spinner /> : <Icon name={state === "done" ? "check" : icon} size={20} />}
      <span className="min-w-0 text-center">{state === "done" && doneLabel ? doneLabel : state === "busy" && busyLabel ? busyLabel : label}</span>
    </button>
  );
}
