"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { sectionFromPath, type SectionKey } from "@/lib/plan/sections";
import { ChappyMarkdown } from "./ChappyMarkdown";
import { CHAPPY_OPEN_EVENT, type ChappyOpenDetail } from "./AskChappyButton";

export interface PlanChappyLabels {
  launcher: string;
  title: string;
  subtitle: string;
  greeting: string;
  suggestionsLabel: string;
  placeholder: string;
  send: string;
  close: string;
  thinking: string;
  error: string;
  busy: string;
  tooMany: string;
  expired: string;
  escalated: string;
  limit: string;
}

interface Props {
  locale: string;
  suggestions: readonly string[];
  labels: PlanChappyLabels;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
  error?: boolean;
}

const MAX_CHARS = 1500;

/**
 * The same motion as the site's ordering Chappy (components/ChappyChat.tsx):
 * a slow breathing pulse on the launcher, a bounce and a chopstick wave on
 * hover, the panel sliding up, replies popping in, bouncing typing dots.
 * All of it is off for readers who ask for reduced motion.
 */
const MOTION = `
@keyframes planChappyPulse { 0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(124, 122, 103, 0.4); } 50% { transform: scale(1.05); box-shadow: 0 6px 30px rgba(124, 122, 103, 0.6); } }
@keyframes planChappyBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes planChappyWave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-10deg); } 75% { transform: rotate(10deg); } }
@keyframes planChappySlideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes planChappyPop { 0% { opacity: 0; transform: scale(0.8) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes planChappyDot { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
.plan-chappy-launcher { animation: planChappyPulse 3s ease-in-out infinite; }
.plan-chappy-launcher:hover, .plan-chappy-launcher:focus-visible { animation: planChappyBounce 0.6s ease-in-out infinite; }
.plan-chappy-launcher:hover .plan-chappy-face, .plan-chappy-launcher:focus-visible .plan-chappy-face { animation: planChappyWave 1s ease-in-out infinite; }
.plan-chappy-panel { animation: planChappySlideUp 0.3s ease-out both; }
.plan-chappy-reply { animation: planChappyPop 0.3s ease-out both; transform-origin: bottom left; }
.plan-chappy-dot { animation: planChappyDot 1.2s infinite; }
@media (prefers-reduced-motion: reduce) {
  .plan-chappy-launcher, .plan-chappy-launcher:hover, .plan-chappy-launcher:focus-visible, .plan-chappy-face, .plan-chappy-panel, .plan-chappy-reply, .plan-chappy-dot { animation: none !important; }
}
`;
const OPEN_KEY = "oh-plan-chappy-open";

function readOpen(): boolean {
  try {
    return window.sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
function writeOpen(v: boolean): void {
  try {
    window.sessionStorage.setItem(OPEN_KEY, v ? "1" : "0");
  } catch {
    /* private mode: the panel just starts closed next page */
  }
}

/**
 * Chappy Chopstix on the business plan. A launcher in the right margin (above
 * the phone nav on small screens) opens a side panel that streams answers
 * from /api/plan/chappy. The panel is not modal: the viewer can keep reading
 * and follow Chappy's section links while it stays open. Everything here is
 * shell chrome (data-plan-shell), so the analytics beacon does not count
 * typing in it as reading the plan; the chat is tracked server-side instead.
 */
export function PlanChappy({ locale, suggestions, labels }: Props) {
  const pathname = usePathname();
  const section: SectionKey | null = sectionFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    if (loaded) return;
    setLoaded(true);
    try {
      const res = await fetch("/api/plan/chappy", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { history?: Msg[] };
      if (data.history?.length) setMessages((m) => (m.length ? m : data.history!.map((h) => ({ role: h.role, content: h.content }))));
    } catch {
      /* history is a nicety */
    }
  }, [loaded]);

  const show = useCallback(
    (detail?: ChappyOpenDetail) => {
      setOpen(true);
      writeOpen(true);
      void loadHistory();
      if (detail?.prefill) setInput(detail.prefill);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    },
    [loadHistory],
  );
  const hide = useCallback(() => {
    setOpen(false);
    writeOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  // Restore an open panel across full page loads (client navigations keep state anyway).
  useEffect(() => {
    if (readOpen()) show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => show((e as CustomEvent<ChappyOpenDetail>).detail);
    window.addEventListener(CHAPPY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CHAPPY_OPEN_EVENT, onOpen);
  }, [show]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // iOS Safari keeps fixed elements sized to the layout viewport when the
  // keyboard opens, so the panel would slide under it or push its header (and
  // the close button) off the top. While the keyboard is up, pin the panel to
  // the visual viewport instead.
  const [keyboard, setKeyboard] = useState<{ top: number; bottom: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!open || !vv) {
      setKeyboard(null);
      return;
    }
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboard(covered > 120 ? { top: Math.max(8, vv.offsetTop + 8), bottom: covered + 8 } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  useEffect(() => grow(inputRef.current), [input]);

  const send = async (text: string) => {
    const message = text.trim().slice(0, MAX_CHARS);
    if (!message || streaming) return;
    setInput("");
    setStreaming(true);
    setStatus(labels.thinking);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    const patchLast = (fn: (m: Msg) => Msg) =>
      setMessages((all) => {
        const next = [...all];
        const last = next[next.length - 1];
        if (last) next[next.length - 1] = fn(last);
        return next;
      });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/plan/chappy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sectionKey: section, locale }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const msg = res.status === 429 ? labels.tooMany : res.status === 401 ? labels.expired : labels.error;
        patchLast((m) => ({ ...m, content: msg, error: true }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let gotText = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          if (!chunk.startsWith("data: ")) continue;
          let ev: { type: string; text?: string; label?: string; escalated?: boolean; code?: string };
          try {
            ev = JSON.parse(chunk.slice(6)) as typeof ev;
          } catch {
            continue;
          }
          if (ev.type === "text" && ev.text) {
            gotText = true;
            setStatus(null);
            patchLast((m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "status" && ev.label) {
            setStatus(ev.label);
          } else if (ev.type === "done") {
            if (ev.escalated) patchLast((m) => ({ ...m, escalated: true }));
          } else if (ev.type === "error") {
            patchLast((m) => (gotText ? m : { ...m, content: ev.code === "busy" ? labels.busy : labels.error, error: true }));
          }
        }
      }
      if (!gotText) patchLast((m) => (m.content ? m : { ...m, content: labels.error, error: true }));
    } catch {
      if (!ctrl.signal.aborted) patchLast((m) => (m.content ? m : { ...m, content: labels.error, error: true }));
    } finally {
      setStreaming(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const empty = messages.length === 0;

  const canSend = !streaming && input.trim().length > 0;

  return (
    <div data-plan-shell="" className="print:hidden">
      <style>{MOTION}</style>

      {/* Launcher. Closed: the chip with Chappy's face (right margin on large screens, above the
          phone nav on small ones). Open: a round close button under the panel, the same pattern as
          the site's ordering Chappy, so there is always a visible way out. Hidden while the phone
          keyboard is up; the panel header keeps its own close button in view then. */}
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => show()}
          aria-label={labels.launcher}
          aria-expanded={false}
          title={labels.launcher}
          className="plan-chappy-launcher group fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 rounded-full border border-oh-stone bg-oh-ink/95 p-1.5 pr-4 text-oh-cream shadow-xl shadow-black/40 backdrop-blur hover:border-oh-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember md:bottom-6 lg:right-[max(1rem,calc((100vw-64rem)/4-4rem))] lg:flex-col lg:gap-1 lg:rounded-2xl lg:p-2 lg:pr-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plan/chappy-192.webp" alt="" width={56} height={56} className="plan-chappy-face h-11 w-11 rounded-full border-2 border-oh-cream/30 bg-oh-cream/10 lg:h-14 lg:w-14" />
          <span className="text-[0.8rem] font-medium leading-tight lg:max-w-[6.5rem] lg:text-center lg:text-[0.72rem] lg:text-oh-mute lg:group-hover:text-oh-cream">{labels.launcher}</span>
        </button>
      ) : keyboard ? null : (
        <button
          ref={launcherRef}
          type="button"
          onClick={hide}
          aria-label={labels.close}
          aria-expanded={true}
          aria-controls="plan-chappy-panel"
          title={labels.close}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-oh-cream/20 p-0 text-oh-cream shadow-xl shadow-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream md:bottom-6 md:right-6"
          style={{ background: "linear-gradient(145deg, var(--color-oh-ember), var(--color-oh-ember-deep))" }}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}

      {/* Phones only: dim the page behind the card so the chat reads as its own layer; a tap outside closes it. */}
      {open ? <div aria-hidden="true" onClick={hide} className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] sm:hidden" /> : null}

      {open ? (
        <section
          id="plan-chappy-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="plan-chappy-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              hide();
            }
          }}
          style={keyboard ? { top: keyboard.top, bottom: keyboard.bottom, left: 8, right: 8, height: "auto", width: "auto" } : undefined}
          className={[
            "plan-chappy-panel fixed z-50 flex flex-col overflow-hidden rounded-[20px] border border-oh-stone bg-oh-charcoal text-oh-cream shadow-2xl shadow-black/60",
            // Phones: a floating card between the plan header and the round close button.
            "inset-x-3 top-[4.75rem] bottom-[calc(8.75rem+env(safe-area-inset-bottom))]",
            // Small tablets (phone nav still showing): a 24rem card above the close button.
            "sm:left-auto sm:right-6 sm:top-auto sm:h-[min(35rem,calc(100dvh-14rem))] sm:w-[24rem]",
            // md and up (no phone nav): the site Chappy's geometry.
            "md:bottom-[6.25rem] md:h-[min(35rem,calc(100dvh-9.5rem))] md:w-[25rem]",
          ].join(" ")}
        >
          <header className="flex items-center gap-3 border-b border-oh-stone px-4 py-3" style={{ background: "linear-gradient(135deg, var(--color-oh-ink), var(--color-oh-charcoal))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/plan/chappy-96.webp" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border-2 border-oh-cream/20 bg-oh-cream/10" />
            <div className="min-w-0 flex-1">
              <h2 id="plan-chappy-title" className="m-0 font-display text-[1.15rem] leading-tight text-oh-cream">
                {labels.title}
              </h2>
              <p className="m-0 truncate text-[0.74rem] text-oh-mute">{labels.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={hide}
              aria-label={labels.close}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-oh-stone bg-oh-charcoal p-0 text-oh-cream hover:border-oh-ember hover:bg-oh-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div ref={logRef} role="log" aria-live="polite" aria-busy={streaming} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 text-[0.9rem] leading-relaxed">
            {empty ? (
              <div>
                <p className="m-0 mb-4 text-oh-cream/90">{labels.greeting}</p>
                <p className="m-0 mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-oh-mute">{labels.suggestionsLabel}</p>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => void send(s)}
                        className="w-full rounded-2xl border border-oh-stone bg-oh-ink/60 px-4 py-2.5 text-left text-[0.86rem] text-oh-cream hover:border-oh-ember hover:bg-oh-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-10 rounded-[18px] rounded-br-md px-4 py-2.5 text-oh-cream" style={{ background: "linear-gradient(135deg, var(--color-oh-ember), var(--color-oh-ember-deep))" }}>
                    {m.content}
                  </div>
                ) : m.content ? (
                  <div key={i} className={["plan-chappy-reply mr-6 rounded-[18px] rounded-bl-md px-4 py-2.5", m.error ? "border border-oh-ember/40 bg-oh-ink text-oh-mute" : "border border-oh-stone/60 bg-oh-ink text-oh-cream/95"].join(" ")}>
                    <ChappyMarkdown text={m.content} />
                    {m.escalated ? <p className="m-0 mt-2 text-[0.72rem] uppercase tracking-[0.12em] text-oh-ember-light">{labels.escalated}</p> : null}
                  </div>
                ) : null,
              )
            )}
            {status ? (
              <p className="m-0 flex items-center gap-2 text-[0.78rem] text-oh-mute">
                <span className="inline-flex gap-1" aria-hidden="true">
                  <span className="plan-chappy-dot h-1.5 w-1.5 rounded-full bg-oh-ember-light" />
                  <span className="plan-chappy-dot h-1.5 w-1.5 rounded-full bg-oh-ember-light [animation-delay:150ms]" />
                  <span className="plan-chappy-dot h-1.5 w-1.5 rounded-full bg-oh-ember-light [animation-delay:300ms]" />
                </span>
                {status}
              </p>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="border-t border-oh-stone bg-oh-ink px-3 py-3"
          >
            {/* One pill, like the site Chappy: a borderless text box and a round send button inside.
                The site's global form rules (globals.css) paint textareas white, most of all on
                :focus, so every surface here is set explicitly, including the focus state. 16px text
                keeps iOS Safari from zooming the page when the box is tapped. */}
            <div className="flex items-end gap-2 rounded-[24px] border border-oh-stone bg-oh-charcoal py-1.5 pl-4 pr-1.5 focus-within:border-oh-ember">
              <label htmlFor="plan-chappy-input" className="sr-only">
                {labels.placeholder}
              </label>
              <textarea
                ref={inputRef}
                id="plan-chappy-input"
                rows={1}
                value={input}
                maxLength={MAX_CHARS}
                enterKeyHint="send"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder={streaming ? labels.thinking : labels.placeholder}
                className="m-0 max-h-[120px] min-h-0 flex-1 resize-none appearance-none overflow-y-auto rounded-none border-0 bg-transparent p-0 py-2.5 font-[inherit] text-[16px] leading-snug text-oh-cream caret-oh-ember shadow-none outline-none placeholder:text-oh-mute focus:border-0 focus:bg-transparent focus:text-oh-cream focus:shadow-none focus:outline-none"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label={labels.send}
                title={labels.send}
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 p-0 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream",
                  canSend ? "scale-100 cursor-pointer text-oh-cream" : "scale-95 cursor-not-allowed bg-oh-stone text-oh-cream/70",
                ].join(" ")}
                style={canSend ? { background: "linear-gradient(135deg, var(--color-oh-ember), var(--color-oh-ember-deep))" } : undefined}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            {input.length > MAX_CHARS - 100 ? <p className="m-0 px-2 pt-2 text-[0.7rem] text-oh-mute">{labels.limit}</p> : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
