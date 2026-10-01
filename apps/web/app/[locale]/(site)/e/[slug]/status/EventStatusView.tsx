"use client";

/**
 * Private events: follow the bowl. Held (PAID): the reservation, the
 * countdown, when and where, and "I'm here", which opens on the event's day
 * in its own zone and releases the bowl to the kitchen. Live (QUEUED on):
 * the stage, the kitchen feed, the visit's timeline, the lines to read while
 * it cooks, and the bowl. No pod, queue, add-ons, "I'm done" or money.
 * Polls through useOrderStatus (every 10 s, in every stage).
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CoBrand } from "@/components/site/events/CoBrand";
import { Countdown } from "@/components/site/events/Countdown";
import { EventMeta } from "@/components/site/events/EventMeta";
import { useEvent } from "@/components/site/events/EventProvider";
import { readRemembered } from "@/components/site/events/remember";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { BackstoryLine, FortuneLine, KitchenFeed, RoastLine } from "@/components/site/order/AiLines";
import { StatusTimeline } from "@/components/site/order/StatusTimeline";
import { CTA_CLASS, Spinner } from "@/components/site/order/StepSheet";
import { useOrderStatus, type StatusOrder } from "@/components/site/order/useOrderStatus";
import { TEXT_LINK } from "@/components/site/store/ui";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { arriveEventOrder, eventPath, eventTitle, fetchEventRsvp, firstName, isEventDayClient, type GuestRsvp } from "@/lib/site/events";
import { BACKSTORY_STAGES, FEED_STAGES } from "@/lib/site/order-status";
import { usePublishOrderBack } from "@/lib/site/order-back";
import "@/components/site/order/after-order.css";

const STAGE_ICON: Record<string, IconName> = {
  QUEUED: "clock",
  PREPPING: "flame",
  READY: "bell",
  SERVING: "bowl",
  COMPLETED: "seal",
  CANCELLED: "alert",
};
const KNOWN = new Set(["PENDING_PAYMENT", "PAID", ...Object.keys(STAGE_ICON)]);
const PAGE = "flex w-full flex-col gap-8 px-4 pt-6 md:mx-auto md:max-w-2xl";

export function EventStatusView({ code: codeParam }: { code: string | null }) {
  const event = useEvent();
  const locale = useLocale();
  const t = useTranslations("events");
  const invite = eventPath(locale, event.slug);
  usePublishOrderBack(invite, t("done.backToInvite"));

  // The code: ?qrCode=, else the order this browser reserved. Resolved after mount (storage is client-only).
  const [code, setCode] = useState<string | null | undefined>(codeParam ?? undefined);
  const [who, setWho] = useState<{ name: string | null; rsvp: GuestRsvp | null }>({ name: null, rsvp: null });
  useEffect(() => {
    const guest = readRemembered(event.slug);
    if (!codeParam) setCode(guest?.orderQrCode ?? null);
    setWho({ name: guest?.name ?? null, rsvp: null });
    if (!guest?.token) return;
    let live = true;
    fetchEventRsvp(event.slug, guest.token).then((rsvp) => {
      if (live && rsvp) setWho({ name: guest.name, rsvp });
    });
    return () => {
      live = false;
    };
  }, [event.slug, codeParam]);

  if (code === undefined) return <Loading />;
  if (!code) return <NotFound invite={invite} />;
  return <Tracked key={code} code={code} who={who} invite={invite} />;
}

function Tracked({ code, who, invite }: { code: string; who: { name: string | null; rsvp: GuestRsvp | null }; invite: string }) {
  const event = useEvent();
  const locale = useLocale();
  const t = useTranslations("events");
  const s = useOrderStatus({ code, demoStageParam: null, followParent: false, locale });
  const order = s.order;

  if (!order) return s.state === "loading" ? <Loading /> : <NotFound invite={invite} />;

  const name = order.guestName || who.name;
  const zodiac = who.rsvp?.zodiac;
  const personal = name ? (
    <Body locale={locale} className="m-0 text-oh-cream/85" data-event-personal>
      {zodiac ? t("status.personal", { name: firstName(name), zodiac: t(`zodiac.${zodiac}`) }) : t("status.personalNoZodiac", { name: firstName(name) })}
    </Body>
  ) : null;

  if (order.status === "PAID") return <Held order={order} personal={personal} onArrived={() => void s.refresh()} />;

  return (
    <div data-event-status data-status-stage={order.status} className={`${PAGE} pb-[calc(var(--dock-h,0px)+2rem)]`}>
      <Reveal className="flex flex-col gap-4">
        <CoBrand event={event} size="sm" />
        {personal}
      </Reveal>
      <Live order={order} feed={s.feed} feedLoading={s.feedLoading} />
      <Link href={invite} className={`${TEXT_LINK} self-center`}>
        {t("done.backToInvite")}
      </Link>
    </div>
  );
}

function Held({ order, personal, onArrived }: { order: StatusOrder; personal: ReactNode; onArrived: () => void }) {
  const event = useEvent();
  const locale = useLocale();
  const t = useTranslations("events");
  const tFlow = useTranslations("orderFlow.errors");
  const [eventDay, setEventDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The phone's clock, after mount; checked again each minute so the button opens at midnight in the event's zone.
  useEffect(() => {
    const check = () => setEventDay(isEventDayClient(event.startsAt, event.timezone));
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [event.startsAt, event.timezone]);

  async function arrive() {
    if (busy || !eventDay) return;
    setBusy(true);
    setError(null);
    const r = await arriveEventOrder(order.orderQrCode);
    if (r.ok) {
      onArrived();
      return; // stays busy until the next status read swaps this view out
    }
    setBusy(false);
    // 400: not the event day by the server's clock. The API's text is English only, so say it in the page's language.
    setError(r.status === 400 ? t("status.notYet") : r.status === 0 ? tFlow("NETWORK_ERROR") : tFlow("GENERIC"));
  }

  return (
    <div data-event-status data-status-stage="PAID" className="flex flex-1 flex-col">
      <div className={`${PAGE} flex-1 pb-8`}>
        {/* The Display below carries the event's name, so the lockup only shows a client logo here. */}
        {event.logoUrl || personal ? (
          <Reveal className="flex flex-col gap-4">
            {event.logoUrl ? <CoBrand event={event} size="sm" /> : null}
            {personal}
          </Reveal>
        ) : null}
        <Reveal className="flex flex-col gap-3">
          <Eyebrow locale={locale} className="flex items-center gap-2 text-oh-ember-light">
            <Icon name="check" size={16} />
            {t("status.held")}
          </Eyebrow>
          <Display locale={locale} className="m-0 text-oh-cream [overflow-wrap:anywhere]">
            {eventTitle(event)}
          </Display>
          <Body locale={locale} className="m-0 text-oh-cream/85">
            {t("status.heldLede")}
          </Body>
        </Reveal>
        <Countdown startsAt={event.startsAt} timezone={event.timezone} />
        <EventMeta event={event} />
        <BowlPanel order={order} />
      </div>

      {/* Phones: pinned in the thumb zone, like the invite's CTA bar. md+: in flow under the page. */}
      <div data-event-cta-bar className="sticky bottom-0 z-30 border-t border-oh-stone/70 bg-oh-charcoal/85 backdrop-blur-md md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:pb-16 md:pt-0">
          {error ? (
            <p role="alert" className="m-0 text-[15px] font-semibold text-oh-ember-light">
              {error}
            </p>
          ) : null}
          {/* A row, so CTA_CLASS's flex-1 fills the width and h-14 holds (in the column it would collapse). */}
          <div className="flex">
            <button type="button" onClick={arrive} disabled={!eventDay || busy} aria-busy={busy ? "true" : "false"} className={`${CTA_CLASS} md:flex-none md:px-8`} data-testid="arrive">
              {busy ? <Spinner /> : <Icon name="pin" size={18} />}
              <span className="truncate">{busy ? t("status.arriving") : t("status.arrive")}</span>
            </button>
          </div>
          {!eventDay ? (
            <Body locale={locale} className="m-0 text-center text-sm text-oh-mute md:text-left" data-event-not-yet>
              {t("status.notYet")}
            </Body>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Live({ order, feed, feedLoading }: { order: StatusOrder; feed: ReturnType<typeof useOrderStatus>["feed"]; feedLoading: boolean }) {
  const event = useEvent();
  const locale = useLocale();
  const tAfter = useTranslations("afterOrder");
  const t = useTranslations("events");
  const status = order.status;
  const known = KNOWN.has(status) ? status : "UNKNOWN";
  const cooking = status !== "CANCELLED";

  return (
    <>
      <section aria-labelledby="event-stage" className="flex flex-col gap-3">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-oh-ember-deep text-oh-cream">
          <Icon name={STAGE_ICON[status] || "bowl"} size={24} />
        </span>
        <Display id="event-stage" key={status} locale={locale} className="oh-stage-in m-0 text-oh-cream [overflow-wrap:anywhere]">
          {tAfter(`status.stages.${known}.title`)}
        </Display>
        {["QUEUED", "PREPPING", "READY"].includes(status) ? (
          <Body locale={locale} className="m-0 text-oh-cream/85">
            {t("status.checkedIn")}
          </Body>
        ) : null}
      </section>

      {FEED_STAGES.includes(status) ? <KitchenFeed feed={feed} loading={feedLoading} /> : null}

      {cooking ? (
        <section aria-labelledby="event-visit" className="rounded-[1.75rem] bg-oh-ink px-5 pb-3 pt-5 ring-1 ring-oh-stone">
          <h2 id="event-visit" className={`m-0 mb-4 text-lg font-semibold text-oh-cream ${locale.startsWith("zh") ? "font-cjk" : "font-body"}`}>
            {tAfter("status.timeline.label")}
          </h2>
          <StatusTimeline
            status={status}
            times={order}
            timeZone={event.timezone}
            labels={{ PAID: t("status.timeline.PAID"), SERVING: t("status.timeline.SERVING") }}
            showTotal={false}
          />
        </section>
      ) : null}

      {cooking ? (
        <div className="flex flex-col gap-4">
          <FortuneLine orderQrCode={order.orderQrCode} />
          <RoastLine orderQrCode={order.orderQrCode} />
          {BACKSTORY_STAGES.includes(status) ? <BackstoryLine orderId={order.id} /> : null}
        </div>
      ) : null}

      <BowlPanel order={order} />
    </>
  );
}

function BowlPanel({ order }: { order: StatusOrder }) {
  const t = useTranslations("events.status");
  if (!order.items.length) return null;
  return (
    <section aria-labelledby="event-status-bowl" className="rounded-[28px] bg-oh-linen p-5 text-oh-charcoal" data-event-status-bowl>
      <h2 id="event-status-bowl" className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-oh-charcoal/75">
        {t("yourBowl")}
      </h2>
      <ul className="m-0 flex list-none flex-col divide-y divide-oh-charcoal/10 p-0">
        {order.items.map((item) => {
          const choice = item.selectedLabel ?? item.selectedValue;
          return (
            <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px] leading-snug">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
              {choice ? <span className="shrink-0 text-oh-charcoal/70">{choice}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Loading() {
  return (
    <div role="status" data-event-status data-status-stage="LOADING" className={`${PAGE} min-h-[60svh] items-center justify-center text-oh-mute`}>
      <Spinner />
    </div>
  );
}

function NotFound({ invite }: { invite: string }) {
  const locale = useLocale();
  const t = useTranslations("events");
  return (
    <div data-event-status data-status-stage="NONE" className={`${PAGE} min-h-[50svh] justify-center pb-16`}>
      <Body locale={locale} className="m-0 text-oh-cream">
        {t("status.notFound")}
      </Body>
      <Link href={invite} className={`${TEXT_LINK} self-start`}>
        {t("done.backToInvite")}
      </Link>
    </div>
  );
}
