"use client";

/**
 * The arrival step (Task D5). The options are the API's own
 * (GET /locations/:id/availability `validArrivalTimes`: "asap" and minutes
 * from now, already cut at closing time); clock times show in the
 * location's zone (America/Denver). The server re-checks the time when the
 * order is created (ARRIVAL_INVALID).
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { arrivalClock } from "@/lib/site/order-flow";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export interface ArrivalPickerProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  timeZone: string;
  preOrder?: boolean;
}

export function ArrivalPicker({ options, value, onChange, timeZone, preOrder }: ArrivalPickerProps) {
  const t = useTranslations("orderFlow.arrival");
  const locale = useLocale();
  // Clock times are client-only (the server's "now" would differ) and tick each minute.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {preOrder ? <p className="m-0 rounded-2xl bg-oh-ink px-4 py-3 text-[15px] leading-relaxed text-oh-cream">{t("preOrder")}</p> : null}
      <div role="radiogroup" aria-label={t("title")} className="flex flex-col gap-2.5">
        {options.map((opt) => {
          const checked = value === opt;
          const minutes = opt === "asap" ? 0 : Number(opt);
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={checked}
              data-arrival={opt}
              onClick={() => onChange(opt)}
              className={`flex min-h-16 w-full cursor-pointer appearance-none items-center gap-4 rounded-3xl border px-4 py-3 text-left font-[inherit] transition-[border-color,background-color] duration-200 motion-reduce:transition-none ${FOCUS} ${
                checked ? "border-oh-ember-light bg-oh-stone/60" : "border-oh-stone bg-oh-ink hover:border-oh-mute"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${checked ? "bg-oh-ember-deep text-oh-cream" : "bg-oh-stone text-oh-cream/80"}`}>
                <Icon name={opt === "asap" ? "flame" : "clock"} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold text-oh-cream">{opt === "asap" ? t("asap") : t("inMinutes", { minutes })}</span>
                <span className="text-sm text-oh-mute">
                  {opt === "asap" ? t("asapNote") : now ? t("at", { time: arrivalClock(minutes, locale, timeZone, now) }) : " "}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-oh-ember-light bg-oh-ember-light text-oh-charcoal" : "border-oh-mute"}`}
              >
                {checked ? <Icon name="check" size={16} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
