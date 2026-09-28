"use client";

/**
 * The conversation (Task E1): the welcome and quick actions when it's empty,
 * then the turns. Chappy's words render as plain text with safe line
 * breaks, plus a tiny markdown subset (paragraphs, "- " lists, **bold**)
 * built from React text nodes: never HTML from the model.
 *
 * Cards: E1 renders a translated fallback box for every card type; Task E2
 * replaces them with the native cards. The sign-in card already works.
 */
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { CHAPPY_AVATAR } from "@/lib/site/nav";
import type { ChappyStatus } from "./useChappyStream";
import { cardKey, errorMessage, isRetryable, toolStatusKey, type ChappyCard, type ChatMessage } from "./stream";

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

      {!empty ? (
        <ol aria-live="polite" aria-relevant="additions text" className="m-0 grid list-none gap-5 p-0 pt-3">
          {messages.map((m) => (
            <li key={m.id} className="chappy-enter min-w-0">
              {m.role === "user" ? (
                <UserTurn text={m.text} label={t("you")} />
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

        {message.cards.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {message.cards.map((card, i) => (
              <CardFallback key={i} card={card} onSignIn={onSignIn} />
            ))}
          </div>
        ) : null}

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

/** E1's stand-in for every card type (E2 builds the native cards). */
function CardFallback({ card, onSignIn }: { card: ChappyCard; onSignIn: () => void }) {
  const t = useTranslations("chappyWeb");
  const key = cardKey(card.type);
  const code = card.type === "group-share" && typeof card.code === "string" ? card.code : null;
  return (
    <section data-chappy-card={card.type} className="rounded-xl border border-oh-stone bg-oh-charcoal/70 px-4 py-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-oh-ember-light">{t(`cards.${key}.title`)}</p>
      <p className="m-0 mt-1 text-sm leading-snug text-oh-cream/90">{t(`cards.${key}.body`)}</p>
      {code ? <p className="m-0 mt-2 font-mono text-lg tracking-[0.2em] text-oh-cream">{code}</p> : null}
      {card.type === "sign-in" ? (
        <button
          type="button"
          onClick={onSignIn}
          className="mt-3 inline-flex min-h-11 cursor-pointer appearance-none items-center rounded-full border-0 bg-oh-ember-deep px-5 font-[inherit] text-sm font-semibold text-oh-cream transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {t("signIn")}
        </button>
      ) : null}
    </section>
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

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** Paragraphs on blank lines, "- " / "1. " lines as a list, single newlines kept as line breaks. */
export function SafeText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);
  return (
    <div data-chappy-text className="grid gap-3 break-words text-base leading-relaxed text-oh-cream/95">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
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
