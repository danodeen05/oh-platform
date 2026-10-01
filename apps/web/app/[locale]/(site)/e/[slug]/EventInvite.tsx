"use client";

/**
 * Private events: the invitation. Lockup, hero bowl, when and where, the
 * host's note, the countdown and the one call to action, pinned to the
 * bottom on phones: reserve a bowl, or, when this phone already reserved
 * one, follow it.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CoBrand } from "@/components/site/events/CoBrand";
import { Countdown } from "@/components/site/events/Countdown";
import { EventMeta } from "@/components/site/events/EventMeta";
import { useEvent } from "@/components/site/events/EventProvider";
import { readRemembered, type RememberedGuest } from "@/components/site/events/remember";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { CTA_CLASS } from "@/components/site/order/StepSheet";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { eventPath, firstName, type GuestRsvp } from "@/lib/site/events";

export function EventInvite({ guest, token }: { guest: GuestRsvp | null; token: string | null }) {
  const event = useEvent();
  const locale = useLocale();
  const t = useTranslations("events");
  const [remembered, setRemembered] = useState<RememberedGuest | null>(null);

  useEffect(() => {
    setRemembered(readRemembered(event.slug));
  }, [event.slug]);

  const rsvpToken = token || remembered?.token || null;
  const greetName = guest?.name || remembered?.name || null;
  const qrCode = remembered?.orderQrCode ?? null;

  return (
    <div data-event-invite className="flex flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-8 px-4 pb-8 pt-6 md:mx-auto md:max-w-2xl">
        <Reveal className="flex flex-col gap-4">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <CoBrand event={event} />
          {event.hostName ? (
            <Body locale={locale} className="m-0 text-oh-cream/85">
              {t("hostedBy", { host: event.hostName })}
            </Body>
          ) : null}
        </Reveal>

        <figure className="m-0 aspect-[4/3] overflow-hidden rounded-[28px] bg-oh-linen">
          <SitePicture
            image="bowl-slices-top"
            sizes="(min-width: 768px) 640px, 100vw"
            alt={t("images.hero")}
            priority
            className="block h-full w-full [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
          />
        </figure>

        <Reveal>
          <EventMeta event={event} />
        </Reveal>

        {event.welcomeNote ? (
          <Reveal className="rounded-3xl bg-oh-ink p-5 ring-1 ring-oh-stone">
            <Title locale={locale} as="p" className="m-0 text-oh-cream [overflow-wrap:anywhere]">
              {event.welcomeNote}
            </Title>
          </Reveal>
        ) : null}

        <Reveal>
          <Countdown startsAt={event.startsAt} timezone={event.timezone} />
        </Reveal>

        {event.isComplimentary || qrCode || greetName ? (
          <Reveal className="flex flex-col gap-4">
            {event.isComplimentary ? (
              <Body locale={locale} className="m-0 text-oh-cream/85">
                {t("onTheHouse")}
              </Body>
            ) : null}
            {qrCode ? (
              <p className="m-0 flex items-center gap-2 text-lg font-semibold text-oh-cream" data-event-reserved>
                <Icon name="check" size={20} className="text-oh-ember-light" />
                {t("reserved")}
              </p>
            ) : greetName ? (
              <Title locale={locale} as="p" className="m-0 text-oh-cream" data-event-greeting>
                {t("greeting", { name: firstName(greetName) })}
              </Title>
            ) : null}
          </Reveal>
        ) : null}
      </div>

      {/* Phones: pinned in the thumb zone, like StepSheet's CTA bar. md+: in flow under the page. */}
      <div data-event-cta-bar className="sticky bottom-0 z-30 border-t border-oh-stone/70 bg-oh-charcoal/85 backdrop-blur-md md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-2xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:pb-16 md:pt-0">
          {qrCode ? (
            <Link href={`${eventPath(locale, event.slug, "status")}?qrCode=${encodeURIComponent(qrCode)}`} className={`${CTA_CLASS} md:flex-none md:px-8`} data-event-status>
              <span className="truncate">{t("seeStatus")}</span>
              <Icon name="arrow" size={18} />
            </Link>
          ) : (
            <Link
              href={`${eventPath(locale, event.slug, "rsvp")}${rsvpToken ? `?rsvp=${encodeURIComponent(rsvpToken)}` : ""}`}
              className={`${CTA_CLASS} md:flex-none md:px-8`}
              data-event-reserve
            >
              <span className="truncate">{t("reserve")}</span>
              <Icon name="arrow" size={18} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
