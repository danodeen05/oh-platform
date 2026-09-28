"use client";

/**
 * The Chappy web chat (Task E1), loaded lazily by ChappyProvider on the
 * first open and kept mounted after that, so the conversation and a turn in
 * flight survive closing and reopening.
 *
 * One conversation, two surfaces: the full-screen ChappySheet on phones and
 * the 420px ChappyPanel from 768px up. Both render the same header,
 * MessageList and Composer, fed by useChappyStream.
 *
 * Task E2: the native cards read ChappyCardProvider (sign-in, sending a
 * card's own message, the member's authed fetch, and onPaid). When a pay
 * card settles, the widget posts the translated system note ("Paid. Order
 * #0012, pod B-07.") and the order's status card, and remembers the order
 * for the site's active-order pill. A Stripe redirect return (`resume`,
 * from ChappyProvider) is verified here the same way.
 */
import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { siteDisplayFont } from "@/components/site/site-fonts";
import { Icon } from "@/components/site/icons/Icon";
import { CHAPPY_AVATAR } from "@/lib/site/nav";
import { PHONE_STAGES } from "@oh/floor-plan";
import { SITE_API_URL, useSiteApi } from "@/lib/site/api";
import { confirmPayment, type Order } from "@/lib/site/orders";
import { ChappyCardProvider, resolvePayReturn, type ChappyCardContext, type ChappyPayReturn } from "./cards";
import { ChappyPanel } from "./ChappyPanel";
import { ChappySheet } from "./ChappySheet";
import { Composer, type ComposerHandle } from "./Composer";
import { MessageList } from "./MessageList";
import { useChappyStream } from "./useChappyStream";
import "./chappy.css";

const DESKTOP = "(min-width: 768px)";

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

export interface ChappyWidgetProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  prefill?: string;
  prefillKey?: number;
  /** A pay card's Stripe redirect return to finish (ChappyProvider read it from the URL). */
  resume?: ChappyPayReturn | null;
}

const ACTIVE_ORDER_KEY = "activeOrderQrCode";

/** The order-status card for an order the API just verified as PAID. */
function paidStatusCard(order: Order, locale: string) {
  const seat = (order.seat && typeof order.seat === "object" ? order.seat : null) as { label?: string | null; number?: string | null } | null;
  const qr = typeof order.orderQrCode === "string" ? order.orderQrCode : null;
  return {
    type: "order-status",
    orderId: order.id,
    kitchenNumber: typeof order.kitchenOrderNumber === "string" ? order.kitchenOrderNumber : null,
    status: order.status || "PAID",
    paid: true,
    // PAID at the moment of payment; a return that finds the order further along shows where it is.
    stage: (PHONE_STAGES as readonly string[]).includes(String(order.status)) ? String(order.status) : "PAID",
    pod: seat?.label || seat?.number || null,
    totalCents: order.totalCents,
    statusPath: qr ? `/${locale}/order/status?orderQrCode=${encodeURIComponent(qr)}` : null,
  };
}

export default function ChappyWidget({ open, onClose, onOpen, prefill, prefillKey, resume }: ChappyWidgetProps) {
  const t = useTranslations("chappyWeb");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const desktop = useIsDesktop();
  const chat = useChappyStream({ locale });
  const clerk = useClerk();
  const api = useSiteApi();
  const composer = useRef<ComposerHandle | null>(null);

  // Sign-in (the sign-in card, a SIGN_IN_REQUIRED error): Clerk's modal
  // can't sit under the sheet's focus trap, so Chappy steps aside and comes
  // back once the member is signed in (with the member's own conversation).
  const [awaitingSignIn, setAwaitingSignIn] = useState(false);
  const signIn = useCallback(() => {
    setAwaitingSignIn(true);
    onClose();
    clerk.openSignIn();
  }, [clerk, onClose]);
  useEffect(() => {
    if (awaitingSignIn && chat.signedIn) {
      setAwaitingSignIn(false);
      onOpen();
    }
  }, [awaitingSignIn, chat.signedIn, onOpen]);
  // The customer dismissed Clerk and opened Chappy by hand: stop waiting, so a
  // sign-in much later (elsewhere on the site) doesn't pop Chappy open.
  useEffect(() => {
    if (open) setAwaitingSignIn(false);
  }, [open]);

  // A pay card (or a redirect return) settled: the system note, the status card, the active-order pill.
  const { addNote } = chat;
  const onPaid = useCallback(
    (order: Order) => {
      const card = paidStatusCard(order, locale);
      const number = card.kitchenNumber || order.orderNumber;
      addNote(card.pod ? t("cards.pay.paidNote", { number, pod: card.pod }) : t("cards.pay.paidNoteNoPod", { number }), [card]);
      try {
        if (typeof order.orderQrCode === "string") localStorage.setItem(ACTIVE_ORDER_KEY, order.orderQrCode);
      } catch {
        /* storage unavailable */
      }
    },
    [addNote, locale, t],
  );

  // A Stripe redirect return (fix round 1): the URL is never trusted and never
  // becomes a pay card. The server decides, for this caller: the order must
  // be their own, and PAID comes only from the verified confirm. Waits for
  // the conversation to load, so the note lands after the history.
  const resumed = useRef<ChappyPayReturn | null>(null);
  useEffect(() => {
    if (!resume || resumed.current === resume || chat.status === "loading") return;
    resumed.current = resume;
    (async () => {
      const outcome = await resolvePayReturn(resume, {
        getOrder: async (orderId) => {
          const res = await api(`${SITE_API_URL}/orders/${encodeURIComponent(orderId)}`);
          return { ok: res.ok, status: res.status, data: res.ok ? await res.json().catch(() => null) : null, error: { code: null } };
        },
        confirm: (orderId, paymentIntentId) => confirmPayment(orderId, paymentIntentId, { fetcher: api }),
      });
      if (outcome.kind === "paid") onPaid(outcome.order as Order);
      else if (outcome.kind === "unknown") {
        // Couldn't check it from here (e.g. signed out): never claim it failed. The webhook settles a real payment.
        addNote(t("cards.pay.returnUnknown"), [], { link: { href: `/${locale}/member/orders`, label: t("cards.pay.ordersLink") } });
      } else addNote(t(outcome.kind === "refunded" ? "cards.pay.refunded" : outcome.kind === "processing" ? "cards.pay.processing" : "cards.pay.returnFailed"), [], { alert: true });
    })();
  }, [resume, chat.status, addNote, api, onPaid, t, locale]);

  const cardContext = useMemo<ChappyCardContext>(
    () => ({ locale, cjk, onSignIn: signIn, send: chat.send, onPaid, api, busy: chat.status !== "idle" }),
    [locale, cjk, signIn, chat.send, onPaid, api, chat.status],
  );

  // With a prefill, put the cursor in the box (the phone sheet otherwise
  // focuses its first control, so the keyboard doesn't jump up uninvited).
  useEffect(() => {
    if (!open || !prefill) return;
    const id = requestAnimationFrame(() => composer.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, prefill, prefillKey]);

  const body = (
    <div data-chappy className={`${siteDisplayFont.variable} ${cjk ? "font-cjk" : "font-body"} flex min-h-0 flex-1 flex-col antialiased`}>
      <header className="flex shrink-0 items-center gap-3 border-0 border-b border-solid border-oh-stone/70 px-4 pb-3 pt-0 md:pt-3">
        <img src={CHAPPY_AVATAR} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full bg-oh-cream/10" />
        <div className="min-w-0 flex-1">
          <h2 className={`${cjk ? "font-display-cjk" : "font-display"} m-0 text-2xl font-normal leading-tight text-oh-cream`}>{t("name")}</h2>
          {/* The tagline introduces Chappy; once a conversation is under way it
              gives its room to "Start over" (long in es/zh on a 360px phone). */}
          {chat.messages.length === 0 ? <p className="m-0 line-clamp-2 text-xs leading-snug text-oh-mute">{t("tagline")}</p> : null}
        </div>
        {chat.messages.length > 0 ? (
          <button
            type="button"
            data-chappy-reset
            onClick={chat.reset}
            className="min-h-11 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent px-3 font-[inherit] text-sm font-semibold text-oh-mute hover:bg-oh-stone/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
          >
            {t("reset")}
          </button>
        ) : null}
        <button
          type="button"
          data-chappy-close
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream/80 hover:bg-oh-stone/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
        >
          <Icon name="close" size={22} title={t("close")} />
        </button>
      </header>
      <ChappyCardProvider value={cardContext}>
        <MessageList messages={chat.messages} status={chat.status} cjk={cjk} onQuick={chat.send} onRetry={chat.retry} onSignIn={signIn} />
      </ChappyCardProvider>
      <Composer ref={composer} onSend={chat.send} busy={chat.status !== "idle"} prefill={prefill} prefillKey={prefillKey} />
    </div>
  );

  return desktop ? (
    <ChappyPanel open={open} onClose={onClose} label={t("dialogLabel")} onOpened={() => composer.current?.focus()}>
      {body}
    </ChappyPanel>
  ) : (
    <ChappySheet open={open} onClose={onClose} label={t("dialogLabel")}>
      {body}
    </ChappySheet>
  );
}
