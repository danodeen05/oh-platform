"use client";

/**
 * Private events: when and where. The date and time are written in the
 * event's own time zone (America/Denver) in the reader's language; the
 * address opens Apple Maps (which hands off to Google Maps off Apple).
 */
import { useLocale, useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import type { PublicEvent } from "@/lib/site/events";

export function formatEventWhen(startsAt: string, timezone: string, locale: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  }
}

export function mapsHref(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

function Row({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oh-stone/60 text-oh-ember-light">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-oh-mute">{label}</dt>
        <dd className="m-0 mt-1 text-base leading-snug text-oh-cream">{children}</dd>
      </div>
    </div>
  );
}

export function EventMeta({ event }: { event: PublicEvent }) {
  const t = useTranslations("events.meta");
  const locale = useLocale();
  return (
    <dl data-event-meta className="m-0 flex flex-col gap-5">
      <Row icon="clock" label={t("when")}>
        <span suppressHydrationWarning>{formatEventWhen(event.startsAt, event.timezone, locale)}</span>
      </Row>
      {event.eventAddress ? (
        <Row icon="pin" label={t("where")}>
          <span className="block [overflow-wrap:anywhere]">{event.eventAddress}</span>
          <a
            href={mapsHref(event.eventAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-oh-cream underline decoration-oh-ember-light decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("directions")}
            <Icon name="arrow" size={16} />
          </a>
        </Row>
      ) : null}
    </dl>
  );
}
