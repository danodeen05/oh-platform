"use client";

/**
 * Private events: the bowl step. The dine-in bowl builder with the event's
 * menu (soup, noodles and the sliders; no extras, no prices: bowls are on
 * the house). A guest who already has a bowl goes straight to it; once the
 * event has started, orders are closed.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEvent } from "@/components/site/events/EventProvider";
import { readRemembered, writeRemembered, type RememberedGuest } from "@/components/site/events/remember";
import { BowlBuilder } from "@/components/site/order/BowlBuilder";
import { Spinner, StepSheet } from "@/components/site/order/StepSheet";
import { PANEL, SECONDARY } from "@/components/site/store/ui";
import { Body } from "@/components/site/Text";
import { clearEventDraft, defaultEventDraft, readEventDraft, writeEventDraft } from "@/lib/site/event-draft";
import { checkEventOrder, eventPath, fetchEventMenuSteps, placeEventOrder } from "@/lib/site/events";
import { bowlComplete, buildLines, withMenuDefaults, type MenuStep, type OrderDraft } from "@/lib/site/order-draft";

type Phase = "loading" | "ready" | "closed" | "failed";

export function EventBowlStep() {
  const event = useEvent();
  const slug = event.slug;
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("events");
  const tFlow = useTranslations("orderFlow.errors");

  const [who, setWho] = useState<RememberedGuest | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [steps, setSteps] = useState<MenuStep[]>([]);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const guest = readRemembered(slug);
    if (!guest) {
      router.replace(eventPath(locale, slug, "rsvp"));
      return;
    }
    setWho(guest);
    if (new Date(event.startsAt) <= new Date()) {
      setPhase("closed");
      return;
    }
    let live = true;
    (async () => {
      const [existing, menu] = await Promise.all([checkEventOrder(slug, guest.phone), fetchEventMenuSteps(slug, locale)]);
      if (!live) return;
      if (existing) {
        writeRemembered(slug, { ...guest, orderQrCode: existing.orderQrCode });
        router.replace(eventPath(locale, slug, "done"));
        return;
      }
      if (!menu || !menu.length) {
        setPhase("failed");
        return;
      }
      const stored = readEventDraft(slug);
      setSteps(menu);
      setDraft(stored ? withMenuDefaults(stored, menu) : defaultEventDraft(menu));
      setPhase("ready");
    })();
    return () => {
      live = false;
    };
  }, [slug, locale, event.startsAt, router]);

  const update = useCallback(
    (fn: (d: OrderDraft) => OrderDraft) =>
      setDraft((d) => {
        if (!d) return d;
        const next = fn(d);
        writeEventDraft(slug, next);
        return next;
      }),
    [slug],
  );

  const reserved = useCallback(
    (orderQrCode: string) => {
      if (!who) return;
      writeRemembered(slug, { ...who, orderQrCode });
      clearEventDraft(slug);
      router.push(eventPath(locale, slug, "done"));
    },
    [who, slug, locale, router],
  );

  async function submit() {
    if (!who || !draft || busy) return;
    setBusy(true);
    setError(null);
    const r = await placeEventOrder(slug, { items: buildLines(draft, steps), guestName: who.name, guestPhone: who.phone, dob: who.dob ?? null });
    if (r.ok && r.data?.orderQrCode) return reserved(r.data.orderQrCode);
    const existing = r.body?.existingOrderQrCode;
    if (typeof existing === "string" && existing) return reserved(existing);
    setBusy(false);
    if (r.status === 0) setError(tFlow("NETWORK_ERROR"));
    else if (r.status === 400 && (r.body?.code === "EVENT_STARTED" || /closed/i.test(r.error ?? ""))) setPhase("closed");
    else setError(tFlow("GENERIC"));
  }

  const backHref = eventPath(locale, slug, "rsvp");

  if (phase === "closed" || phase === "failed") {
    return (
      <StepSheet step="bowl" progress={false} title={t("bowl.title")} backHref={backHref}>
        <div className={`${PANEL} flex flex-col gap-4`} data-event-bowl-closed={phase === "closed" ? "" : undefined} role="status">
          <Body locale={locale} className="m-0 text-oh-cream">
            {phase === "closed" ? t("bowl.closed") : tFlow("GENERIC")}
          </Body>
          {who?.orderQrCode ? (
            <Link href={`${eventPath(locale, slug, "status")}?qrCode=${encodeURIComponent(who.orderQrCode)}`} className={`${SECONDARY} self-start`}>
              {t("seeStatus")}
            </Link>
          ) : null}
        </div>
      </StepSheet>
    );
  }

  const complete = draft ? bowlComplete(draft, steps) : false;

  return (
    <StepSheet
      step="bowl"
      progress={false}
      title={t("bowl.title")}
      lede={t("bowl.lede")}
      backHref={backHref}
      wide
      summary={<span className="block max-w-[8.5rem] text-sm leading-snug text-oh-cream/85">{t("onTheHouse")}</span>}
      cta={phase === "ready" ? { label: t("bowl.cta"), onClick: submit, disabled: !complete, busy, dataAttr: "data-event-reserve-bowl" } : null}
      alert={error}
    >
      {phase === "ready" && draft ? (
        <BowlBuilder steps={steps} draft={draft} update={update} hidePrices />
      ) : (
        <p className="m-0 flex items-center gap-3 text-oh-mute" role="status" data-event-bowl-loading>
          <Spinner />
          {t("bowl.loading")}
        </p>
      )}
    </StepSheet>
  );
}
