"use client";

/**
 * The visit, stage by stage (Task D6). The six stages are `PHONE_STAGES`
 * from `@oh/floor-plan`, the list the business plan's floor plan walks its
 * phone through. Done stages carry a check and the clock time they began
 * (in the location's zone); the current one pulses (not under reduced
 * motion); the rest wait in stone.
 */
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { formatClock, timeline, visitMinutes, type OrderTimes } from "@/lib/site/order-status";

export function StatusTimeline({ status, times, timeZone }: { status: string; times: OrderTimes; timeZone: string }) {
  const t = useTranslations("afterOrder.status.timeline");
  const locale = useLocale();
  const steps = timeline(status, times);
  const minutes = visitMinutes(times);

  return (
    <div>
      <ol aria-label={t("label")} className="m-0 list-none p-0">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const clock = formatClock(s.at, locale, timeZone);
          return (
            <li key={s.stage} data-timeline-step={s.stage} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined} className="relative flex min-h-12 gap-3.5">
              {/* The rail between markers. */}
              {!last ? (
                <span aria-hidden="true" className={`absolute left-[13px] top-7 bottom-0 w-0.5 rounded-full ${s.state === "done" ? "bg-oh-ember-light/70" : "bg-oh-stone"}`} />
              ) : null}
              <span aria-hidden="true" className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                {s.state === "done" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-oh-ember-light text-oh-charcoal">
                    <Icon name="check" size={16} />
                  </span>
                ) : s.state === "current" ? (
                  <>
                    <span className="oh-status-pulse absolute inset-0 rounded-full bg-oh-ember-light/40" />
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-oh-ember-light bg-oh-charcoal">
                      <span className="h-2.5 w-2.5 rounded-full bg-oh-ember-light" />
                    </span>
                  </>
                ) : (
                  <span className="h-7 w-7 rounded-full border-2 border-oh-stone bg-oh-charcoal" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pb-4 pt-1">
                <span className={`min-w-0 text-[15px] leading-snug ${s.state === "upcoming" ? "text-oh-mute" : "font-semibold text-oh-cream"}`}>
                  {t(s.stage)}
                  {s.state === "current" ? <span className="sr-only">{`, ${t("now")}`}</span> : null}
                </span>
                {clock ? <span className="shrink-0 text-sm tabular-nums text-oh-mute">{clock}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {minutes !== null ? (
        <p data-visit-minutes className="m-0 mt-1 border-t border-oh-stone/70 pt-3 text-sm text-oh-mute">
          {t("totalTime", { minutes })}
        </p>
      ) : null}
    </div>
  );
}
