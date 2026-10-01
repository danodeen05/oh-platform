"use client";

/**
 * Private events: the bowl is reserved. Greets the guest by first name,
 * lists the bowl as the kitchen has it, repeats when and where, then offers
 * the status page and, until the event starts, a way to start over with a
 * new bowl (cancels this one).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { EventMeta } from "@/components/site/events/EventMeta";
import { useEvent } from "@/components/site/events/EventProvider";
import { readRemembered, writeRemembered, type RememberedGuest } from "@/components/site/events/remember";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Spinner } from "@/components/site/order/StepSheet";
import { PRIMARY, SECONDARY, TEXT_LINK } from "@/components/site/store/ui";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { cancelEventOrder, eventPath, fetchEventOrder, firstName, type EventOrderItem } from "@/lib/site/events";
import { usePublishOrderBack } from "@/lib/site/order-back";

export function EventDone() {
  const event = useEvent();
  const slug = event.slug;
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("events.done");
  const tFlow = useTranslations("orderFlow.errors");

  const [who, setWho] = useState<RememberedGuest | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [items, setItems] = useState<EventOrderItem[] | null>(null);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = eventPath(locale, slug);
  usePublishOrderBack(invite, t("backToInvite"));

  useEffect(() => {
    const guest = readRemembered(slug);
    if (!guest?.orderQrCode) {
      router.replace(invite);
      return;
    }
    setWho(guest);
    setStarted(new Date(event.startsAt) <= new Date());
    let live = true;
    fetchEventOrder(guest.orderQrCode, locale).then((order) => {
      if (!live) return;
      if (order?.status === "CANCELLED") {
        // Cancelled elsewhere: forget it and build a new bowl.
        const { orderQrCode: _gone, ...rest } = guest;
        writeRemembered(slug, rest);
        router.replace(eventPath(locale, slug, "order"));
        return;
      }
      setOrderId(order?.id ?? null);
      setItems(order?.items ?? []);
    });
    return () => {
      live = false;
    };
  }, [slug, locale, invite, event.startsAt, router]);

  async function change() {
    if (!who || !orderId || busy) return;
    if (!window.confirm(t("changeConfirm"))) return;
    setBusy(true);
    setError(null);
    const ok = await cancelEventOrder(slug, orderId);
    if (!ok) {
      setBusy(false);
      setError(tFlow("GENERIC"));
      return;
    }
    const { orderQrCode: _gone, ...rest } = who;
    writeRemembered(slug, rest);
    router.push(eventPath(locale, slug, "order"));
  }

  if (!who?.orderQrCode) return null;
  const statusHref = `${eventPath(locale, slug, "status")}?qrCode=${encodeURIComponent(who.orderQrCode)}`;

  return (
    <div data-event-done className="flex w-full flex-1 flex-col gap-8 px-4 pb-16 pt-6 md:mx-auto md:max-w-2xl">
      <Reveal className="flex flex-col gap-3">
        <Eyebrow locale={locale} className="flex items-center gap-2 text-oh-ember-light">
          <Icon name="check" size={16} />
          {t("eyebrow")}
        </Eyebrow>
        <Display locale={locale} className="m-0 text-oh-cream [overflow-wrap:anywhere]">
          {t("title", { name: firstName(who.name) })}
        </Display>
        <Body locale={locale} className="m-0 text-oh-cream/85">
          {t("lede")}
        </Body>
      </Reveal>

      <section aria-labelledby="event-done-bowl" className="rounded-[28px] bg-oh-linen p-5 text-oh-charcoal" data-event-done-bowl>
        <h2 id="event-done-bowl" className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-oh-charcoal/75">
          {t("yourBowl")}
        </h2>
        {items === null ? (
          <Spinner className="text-oh-charcoal/60" />
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-oh-charcoal/10 p-0">
            {items.map((item, i) => {
              const choice = item.selectedLabel ?? item.selectedValue;
              return (
                <li key={`${item.name}-${i}`} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px] leading-snug">
                  <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
                  {choice ? <span className="shrink-0 text-oh-charcoal/70">{choice}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EventMeta event={event} />

      <div className="flex flex-col gap-3">
        <Link href={statusHref} className={`${PRIMARY} min-h-14 w-full`} data-event-status>
          {t("status")}
          <Icon name="arrow" size={18} />
        </Link>
        {!started && orderId ? (
          <button type="button" onClick={change} disabled={busy} aria-busy={busy ? "true" : "false"} className={`${SECONDARY} min-h-14 w-full`} data-event-change>
            {busy ? <Spinner /> : null}
            {t("change")}
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="m-0 text-[15px] font-semibold text-oh-ember-light">
            {error}
          </p>
        ) : null}
        <Link href={invite} className={`${TEXT_LINK} self-center`}>
          {t("backToInvite")}
        </Link>
      </div>
    </div>
  );
}
