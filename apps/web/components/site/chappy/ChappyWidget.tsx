"use client";

/**
 * The Chappy web chat (Task E1), loaded lazily by ChappyProvider on the
 * first open and kept mounted after that, so the conversation and a turn in
 * flight survive closing and reopening.
 *
 * One conversation, two surfaces: the full-screen ChappySheet on phones and
 * the 420px ChappyPanel from 768px up. Both render the same header,
 * MessageList and Composer, fed by useChappyStream.
 */
import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { siteFontVariables } from "@/components/site/fonts";
import { Icon } from "@/components/site/icons/Icon";
import { CHAPPY_AVATAR } from "@/lib/site/nav";
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
}

export default function ChappyWidget({ open, onClose, onOpen, prefill, prefillKey }: ChappyWidgetProps) {
  const t = useTranslations("chappyWeb");
  const locale = useLocale();
  const cjk = locale.startsWith("zh");
  const desktop = useIsDesktop();
  const chat = useChappyStream({ locale });
  const clerk = useClerk();
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

  // With a prefill, put the cursor in the box (the phone sheet otherwise
  // focuses its first control, so the keyboard doesn't jump up uninvited).
  useEffect(() => {
    if (!open || !prefill) return;
    const id = requestAnimationFrame(() => composer.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, prefill, prefillKey]);

  const body = (
    <div data-chappy className={`${siteFontVariables} ${cjk ? "font-cjk" : "font-body"} flex min-h-0 flex-1 flex-col antialiased`}>
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
      <MessageList messages={chat.messages} status={chat.status} cjk={cjk} onQuick={chat.send} onRetry={chat.retry} onSignIn={signIn} />
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
