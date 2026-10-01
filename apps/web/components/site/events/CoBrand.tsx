"use client";

/**
 * Private events: the co-brand lockup. The Oh! mark, the client's logo on a
 * paper chip when the event has one, then the event name in the Display
 * face. `size="sm"` is the compact form for the inner steps.
 */
import { useLocale } from "next-intl";
import { Display, Title } from "@/components/site/Text";
import { eventTitle, type PublicEvent } from "@/lib/site/events";

export function CoBrand({ event, size = "lg" }: { event: PublicEvent; size?: "lg" | "sm" }) {
  const locale = useLocale();
  const lg = size === "lg";
  const mark = lg ? 56 : 40;
  const title = eventTitle(event);
  return (
    <div data-cobrand className="flex min-w-0 flex-col">
      <div className={`flex items-center ${lg ? "gap-4" : "gap-3"}`}>
        <img src="/brand/oh-mark-light-204.webp" alt="" width={mark} height={mark} decoding="async" className="shrink-0 object-contain" style={{ width: mark, height: mark }} />
        {event.logoUrl ? (
          <>
            <span aria-hidden="true" className={`w-px shrink-0 bg-oh-cream/30 ${lg ? "h-10" : "h-7"}`} />
            <span className={`flex min-w-0 items-center justify-center rounded-2xl bg-oh-paper ${lg ? "h-14 px-4" : "h-10 px-3"}`}>
              <img
                src={event.logoUrl}
                alt={event.clientCompany}
                decoding="async"
                referrerPolicy="no-referrer"
                className={`block w-auto object-contain ${lg ? "max-h-9 max-w-[148px]" : "max-h-6 max-w-[104px]"}`}
              />
            </span>
          </>
        ) : null}
      </div>
      {lg ? (
        <Display locale={locale} className="m-0 mt-5 text-oh-cream [overflow-wrap:anywhere] [text-wrap:balance]">
          {title}
        </Display>
      ) : (
        <Title locale={locale} as="p" className="m-0 mt-3 text-oh-cream [overflow-wrap:anywhere]">
          {title}
        </Title>
      )}
    </div>
  );
}
