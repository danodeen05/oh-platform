"use client";

/**
 * Task D1: a location card's live rows. Open or closed now, today's hours
 * (from the location's operatingHours when it has them, else the closing
 * time the availability endpoint reports), and pods free. Same shared
 * poller as the hero (useLiveStatus). A row without real data isn't shown.
 */
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { formatClock, hoursToday, useLiveStatus } from "@/lib/site/live";

export function LocationLive({ id, operatingHours, timeZone }: { id: string | null; operatingHours: unknown; timeZone: string }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const state = useLiveStatus(id);
  // Today's hours depend on the clock, so they're computed after mount (no hydration drift).
  const [today, setToday] = useState<ReturnType<typeof hoursToday>>(null);
  useEffect(() => setToday(hoursToday(operatingHours, new Date(), timeZone)), [operatingHours, timeZone]);

  const data = state.status === "ready" ? state.data : null;
  let hours: string | null = null;
  if (today === "closed") hours = t("locations.closedToday");
  else if (today) hours = t("locations.hours", { open: formatClock(today.open, locale), close: formatClock(today.close, locale) });
  else if (data?.isOpen && data.closesAt !== null) hours = t("live.until", { time: formatClock(data.closesAt, locale) });

  return (
    <ul data-live-ready={state.status === "loading" ? "false" : "true"} className="m-0 mt-5 grid min-h-[4.5rem] list-none gap-2 p-0 text-base">
      {data && data.isOpen !== null ? (
        <li data-location-open={String(data.isOpen)} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            data-open={String(data.isOpen)}
            className={`hm-live-dot relative inline-block size-2 shrink-0 rounded-full ${data.isOpen ? "bg-oh-olive-light" : "bg-oh-ash"}`}
          />
          <span className="font-semibold text-oh-cream">{data.isOpen ? t("live.open") : t("live.closed")}</span>
          {hours ? <span className="text-oh-cream/75">{hours}</span> : null}
        </li>
      ) : hours ? (
        <li className="flex items-center gap-2.5 text-oh-cream/75">
          <Icon name="clock" size={18} className="shrink-0 text-oh-cream/60" />
          {hours}
        </li>
      ) : null}
      {data && data.isOpen !== false && data.podsFree !== null ? (
        <li className="flex items-center gap-2.5 text-oh-cream/75">
          <Icon name="pod" size={18} className="shrink-0 text-oh-gold" />
          <span data-live-pods data-value={data.podsFree} className="tabular-nums">
            {t("live.podsFree", { count: data.podsFree })}
          </span>
        </li>
      ) : null}
    </ul>
  );
}
