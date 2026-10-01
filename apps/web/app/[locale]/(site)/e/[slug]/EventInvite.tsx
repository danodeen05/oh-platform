"use client";

/**
 * Private events: the invitation. Lockup, hero bowl, when and where, the
 * host's note, the countdown and the one call to action: reserve a bowl,
 * or, when this phone already reserved one, follow it.
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
import { PRIMARY, SECONDARY } from "@/components/site/store/ui";
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
    <div data-event-invite className="flex flex-col gap-8 px-4 pb-[calc(var(--dock-h,0px)+2rem)] pt-6 md:mx-auto md:max-w-2xl">
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

      <Reveal className="flex flex-col gap-4">
        {event.isComplimentary ? (
          <Body locale={locale} className="m-0 text-oh-cream/85">
            {t("onTheHouse")}
          </Body>
        ) : null}
        {qrCode ? (
          <>
            <p className="m-0 flex items-center gap-2 text-lg font-semibold text-oh-cream" data-event-reserved>
              <Icon name="check" size={20} className="text-oh-ember-light" />
              {t("reserved")}
            </p>
            <Link href={`${eventPath(locale, event.slug, "status")}?qrCode=${encodeURIComponent(qrCode)}`} className={`${SECONDARY} w-full sm:w-auto sm:self-start`}>
              {t("seeStatus")}
              <Icon name="arrow" size={18} />
            </Link>
          </>
        ) : (
          <>
            {greetName ? (
              <Title locale={locale} as="p" className="m-0 text-oh-cream" data-event-greeting>
                {t("greeting", { name: firstName(greetName) })}
              </Title>
            ) : null}
            <Link
              href={`${eventPath(locale, event.slug, "rsvp")}${rsvpToken ? `?rsvp=${encodeURIComponent(rsvpToken)}` : ""}`}
              className={`${PRIMARY} w-full sm:w-auto sm:self-start`}
              data-event-reserve
            >
              {t("reserve")}
              <Icon name="arrow" size={18} />
            </Link>
          </>
        )}
      </Reveal>
    </div>
  );
}
