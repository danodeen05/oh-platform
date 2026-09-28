"use client";

/**
 * The conversation (Task E1): the welcome and quick actions when it's empty,
 * then the turns. Chappy's words render as plain text with safe line
 * breaks, plus a tiny markdown subset (paragraphs, "- " lists, **bold**)
 * built from React text nodes: never HTML from the model.
 *
 * Cards: the native cards (Task E2, ./cards) through renderCard; a type
 * this build doesn't know keeps E1's translated fallback box. Within one
 * turn only the latest cart / order-status / reward card shows. A "note"
 * is the widget's own line (a pay card settled), with its cards.
 */
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { CHAPPY_AVATAR } from "@/lib/site/nav";
import type { ChappyStatus } from "./useChappyStream";
import { renderCard, visibleCards } from "./cards";
import { errorMessage, isRetryable, toolStatusKey, type ChatMessage } from "./stream";

export const QUICK_ACTIONS = ["usual", "today", "where", "problem"] as const;

interface MessageListProps {
  messages: ChatMessage[];
  status: ChappyStatus;
  cjk: boolean;
  onQuick: (text: string) => void;
  onRetry: () => void;
  onSignIn: () => void;
}

export function MessageList({ messages, status, cjk, onQuick, onRetry, onSignIn }: MessageListProps) {
  const t = useTranslations("chappyWeb");
  const scroller = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);

  // Follow the conversation while the reader is at (or near) the bottom;
  // leave them alone once they scroll up to reread.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    pinned.current = true; // a new question always brings the reply into view
  }, [lastUser]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });

  // Keep the bottom in view when the scroller itself shrinks (the keyboard opening).
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const empty = messages.length === 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastReply = lastAssistant && !lastAssistant.pending && !lastAssistant.id.startsWith("h-") ? lastAssistant.text : "";
  const display = cjk ? "font-display-cjk" : "font-display";

  return (
    <div
      ref={scroller}
      data-chappy-messages
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 [scrollbar-width:thin]"
    >
      {status === "loading" && empty ? (
        <p role="status" className="m-0 mt-6 flex items-center gap-3 text-sm text-oh-mute">
          <span className="chappy-brush" aria-hidden="true" />
          {t("loading")}
        </p>
      ) : null}

      {status !== "loading" && empty ? (
        <div data-chappy-welcome className="chappy-enter pt-4">
          <p className={`${display} m-0 text-[1.65rem] font-normal leading-[1.2] text-oh-cream`}>{t("welcome")}</p>
          <p className="m-0 mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-oh-mute">{t("quickTitle")}</p>
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">
            {QUICK_ACTIONS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  data-chappy-quick={key}
                  onClick={() => onQuick(t(`quick.${key}`))}
                  className="flex min-h-12 w-full cursor-pointer appearance-none items-center gap-3 rounded-xl border border-oh-stone bg-oh-charcoal/60 px-4 py-2.5 text-left font-[inherit] text-base text-oh-cream transition-colors hover:border-oh-ash hover:bg-oh-stone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                >
                  <span className="min-w-0 flex-1">{t(`quick.${key}`)}</span>
                  <Icon name="arrow" size={18} className="shrink-0 text-oh-ember-light" />
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-6 text-xs leading-relaxed text-oh-mute">{t("note")}</p>
        </div>
      ) : null}

      {/* Screen readers hear each reply once, when it has finished streaming,
          not every delta (the list itself is not live). Restored history is
          not announced; errors announce themselves (role="alert"). */}
      <p aria-live="polite" className="sr-only">
        {lastReply}
      </p>

      {!empty ? (
        <ol className="m-0 grid list-none gap-5 p-0 pt-3">
          {messages.map((m) => (
            <li key={m.id} className="chappy-enter min-w-0">
              {m.role === "user" ? (
                <UserTurn text={m.text} label={t("you")} />
              ) : m.role === "note" ? (
                <NoteTurn message={m} />
              ) : (
                <ChappyTurn message={m} busy={status === "streaming"} onRetry={onRetry} onSignIn={onSignIn} />
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function UserTurn({ text, label }: { text: string; label: string }) {
  return (
    <div data-chappy-turn="user" className="ml-auto w-fit max-w-[85%]">
      <span className="sr-only">{label}: </span>
      {/* Not a bubble: the customer's words sit right, set off by an ember rule. */}
      <p className="m-0 whitespace-pre-wrap break-words border-0 border-r-2 border-solid border-oh-ember py-0.5 pr-3 text-right text-base leading-snug text-oh-cream">
        {text}
      </p>
    </div>
  );
}

function ChappyTurn({ message, busy, onRetry, onSignIn }: { message: ChatMessage; busy: boolean; onRetry: () => void; onSignIn: () => void }) {
  const t = useTranslations("chappyWeb");
  const working = message.pending && (!message.text || message.tool);
  const err = message.error ? errorMessage(message.error.code, message.error.retryAfterSeconds) : null;

  return (
    <div data-chappy-turn="assistant" className="flex min-w-0 gap-3" aria-busy={message.pending || undefined}>
      <img src={CHAPPY_AVATAR} alt="" width={28} height={28} className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-oh-cream/10" />
      <div className="min-w-0 flex-1">
        <span className="sr-only">{t("name")}: </span>
        {message.text ? <SafeText text={message.text} /> : null}

        {working ? (
          <p data-chappy-working role="status" className={`m-0 flex items-center gap-3 text-sm text-oh-mute ${message.text ? "mt-3" : "mt-1.5"}`}>
            <span className="chappy-brush" aria-hidden="true" />
            <span className="min-w-0 truncate">{t(`tools.${toolStatusKey(message.tool)}`)}</span>
          </p>
        ) : null}

        {message.cards.length > 0 ? <Cards cards={message.cards} spaced={!!message.text} /> : null}

        {err ? (
          <div data-chappy-error={message.error?.code} role="alert" className={message.text ? "mt-3" : ""}>
            <p className="m-0 flex gap-2 text-[0.95rem] leading-snug text-oh-ember-light">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>{err.values ? t(`errors.${err.key}`, err.values) : t(`errors.${err.key}`)}</span>
            </p>
            {message.error?.code === "SIGN_IN_REQUIRED" ? (
              <ActionButton onClick={onSignIn}>{t("signIn")}</ActionButton>
            ) : isRetryable(message.error?.code) ? (
              <ActionButton onClick={onRetry} disabled={busy}>
                {t("retry")}
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 inline-flex min-h-11 cursor-pointer appearance-none items-center rounded-full border border-oh-stone bg-transparent px-4 font-[inherit] text-sm font-semibold text-oh-cream transition-colors hover:border-oh-ash hover:bg-oh-stone/40 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
    >
      {children}
    </button>
  );
}

function Cards({ cards, spaced }: { cards: ChatMessage["cards"]; spaced: boolean }) {
  return (
    <div className={`${spaced ? "mt-3" : "mt-1"} grid gap-3`}>
      {visibleCards(cards).map((card, i) => (
        <div key={`${card.type}-${i}`} className="chappy-card-enter min-w-0">
          {renderCard(card)}
        </div>
      ))}
    </div>
  );
}

/** The widget's own line (Task E2): a pay card settled. A quiet check, not a speech turn. */
function NoteTurn({ message }: { message: ChatMessage }) {
  return (
    <div data-chappy-turn="note" data-note-alert={message.alert || undefined} className="flex min-w-0 gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${message.alert ? "bg-oh-stone text-oh-ember-light" : "bg-oh-olive text-oh-cream"}`} aria-hidden="true">
        <Icon name={message.alert ? "alert" : "check"} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p role="status" className="m-0 pt-0.5 text-[0.95rem] font-semibold leading-snug text-oh-cream">
          {message.text}
        </p>
        {message.link && message.link.href.startsWith("/") && !message.link.href.startsWith("//") ? (
          <a
            href={message.link.href}
            data-note-link
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-solid border-oh-stone px-4 text-sm font-semibold text-oh-cream no-underline hover:border-oh-ash hover:bg-oh-stone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {message.link.label}
            <Icon name="arrow" size={16} className="text-oh-ember-light" />
          </a>
        ) : null}
        {message.cards.length > 0 ? <Cards cards={message.cards} spaced /> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Safe text                                                                  */
/* -------------------------------------------------------------------------- */

/** **bold** spans as <strong>; everything else stays a text node. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={m.index} className="font-semibold text-oh-cream">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+/;

/** Paragraphs on blank lines, "- " lines as a list, "1. " lines as a numbered list, single newlines kept as line breaks. */
export function SafeText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);
  return (
    <div data-chappy-text className="grid gap-3 break-words text-base leading-relaxed text-oh-cream/95">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => NUMBERED.test(l))) {
          // Chappy's steps keep their numbers (the model's own, so "3." stays 3).
          return (
            <ol key={bi} className="m-0 grid list-none gap-1.5 p-0">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2.5">
                  <span className="min-w-[1.25em] shrink-0 text-right font-semibold tabular-nums text-oh-ember-light">
                    {l.match(NUMBERED)?.[1]}.
                  </span>
                  <span className="min-w-0">{inline(l.replace(NUMBERED, ""))}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (lines.every((l) => BULLET.test(l))) {
          return (
            <ul key={bi} className="m-0 grid list-none gap-1.5 p-0">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-oh-ember-light" />
                  <span className="min-w-0">{inline(l.replace(BULLET, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="m-0 whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}
