"use client";

/**
 * Site follow-up (2026-09-28), experience step 05: the real guest order
 * status page, running the synthetic DEMO-PLAN order, inside a phone drawn
 * in the site's own tokens (no plan loader video, no plan colors).
 *
 * - The page inside is laid out at a real phone's 390 x 844 CSS pixels and
 *   scaled to the frame's width with a ResizeObserver (the plan PhoneFrame's
 *   pattern), so it never re-flows.
 * - The iframe mounts only once the step is within one screen of the
 *   viewport (IntersectionObserver). Until then, and until it has loaded,
 *   a static poster holds the screen, so first-load JS and LCP don't move.
 * - Phones (below 768px): the inline phone is a preview. It is `inert` and
 *   `pointer-events: none`, so a swipe over it scrolls the page and never
 *   gets trapped in the iframe. "Try it live" (a 44px button) opens the
 *   site bottom sheet with a full-height interactive embed. The sheet's
 *   framer-motion code loads on first touch or open (LazySheet), and the
 *   sheet is portaled to <body>, clear of any transformed ancestor.
 * - 768px and up: the inline phone is interactive, and the button is gone.
 *
 * Copy and icons come in as props (resolved on the server), so this island
 * adds nothing to the (site) client message scope or the icon paths.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LazySheet, preloadSheet } from "@/components/site/motion/LazySheet";

/** The page inside renders at a real phone's CSS size and is scaled to fit the frame. */
const SCREEN_W = 390;
const SCREEN_H = 844;
const WIDE = "(min-width: 768px)";

export interface StatusPhoneProps {
  /** The embed URL, `statusDemoSrc(locale)`: DEMO-PLAN, embed=1, self-playing. */
  src: string;
  /** The iframe's accessible title. */
  title: string;
  /** Poster line shown on the screen until the page has loaded. */
  poster: string;
  /** Poster mark (a server-rendered icon). */
  posterIcon?: ReactNode;
  tryLive: string;
  sheetLabel: string;
  close: string;
  closeIcon?: ReactNode;
}

/** True at 768px and up; false on the server and on phones (mobile first). */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/** Flips to true once `ref` comes within one screen of the viewport, and stays true. */
function useNear(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px 100% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near]);
  return near;
}

export function StatusPhone({ src, title, poster, posterIcon, tryLive, sheetLabel, close, closeIcon }: StatusPhoneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  // The sheet portals to <body>, which exists only after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const near = useNear(rootRef);
  const wide = useWide();

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SCREEN_W);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Leaving the phone layout closes the sheet: at 768px and up the phone itself is interactive.
  useEffect(() => {
    if (wide) setOpen(false);
  }, [wide]);

  return (
    <div ref={rootRef} data-status-phone data-near={near ? "true" : "false"} data-loaded={loaded ? "true" : "false"} className="flex items-start gap-4 md:block">
      {/* Phones: a preview only (inert, no pointer events), so page scroll always wins. */}
      <div data-status-phone-frame inert={!wide} className="pointer-events-none w-[calc(100%_-_var(--xp-card-w)_-_0.5rem)] max-w-[15rem] shrink-0 md:pointer-events-auto md:max-w-none md:w-[17rem] lg:w-[18.5rem]">
        <div className="relative rounded-[2.6rem] border border-oh-stone bg-[linear-gradient(160deg,var(--color-oh-stone)_0%,var(--color-oh-ink)_55%,var(--color-oh-charcoal)_100%)] p-[9px] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.85)]">
          <span aria-hidden="true" className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-oh-stone" />
          <span aria-hidden="true" className="absolute -right-[3px] top-[28%] h-14 w-[3px] rounded-r bg-oh-stone" />
          <div ref={screenRef} className="relative overflow-hidden rounded-[2.05rem] bg-oh-ink ring-1 ring-oh-stone/70" style={{ aspectRatio: `${SCREEN_W} / ${SCREEN_H}` }}>
            {/* The poster: holds the screen until the live page has loaded. */}
            <div
              data-status-poster
              aria-hidden="true"
              className={`xp-status-poster absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center ${loaded ? "opacity-0" : "opacity-100"}`}
            >
              <span className="text-oh-gold">{posterIcon}</span>
              <span className="text-sm font-semibold text-oh-cream/85">{poster}</span>
              <span className="mt-2 flex w-full max-w-[9rem] flex-col gap-2">
                <span className="block h-2 w-full rounded-full bg-oh-stone/70" />
                <span className="block h-2 w-4/5 rounded-full bg-oh-stone/50" />
                <span className="block h-2 w-3/5 rounded-full bg-oh-stone/40" />
              </span>
            </div>
            {near && scale > 0 ? (
              <iframe
                data-status-iframe
                src={src}
                title={title}
                onLoad={() => setLoaded(true)}
                className={`xp-status-frame absolute left-0 top-0 border-0 ${loaded ? "opacity-100" : "opacity-0"}`}
                style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
              />
            ) : null}
            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[8px] h-[18px] w-[30%] -translate-x-1/2 rounded-full bg-oh-charcoal" />
          </div>
        </div>
      </div>

      <button
        type="button"
        data-status-try
        onClick={() => setOpen(true)}
        onPointerDown={preloadSheet}
        onFocus={preloadSheet}
        className="mt-[calc(var(--xp-card-h)_+_1rem)] inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full border-0 bg-oh-ember-deep px-3 py-2 text-center leading-tight font-[inherit] text-base font-semibold text-oh-cream shadow-[0_12px_32px_-14px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream md:hidden [overflow-wrap:anywhere]"
      >
        {tryLive}
      </button>

      {mounted
        ? createPortal(
            <LazySheet
              open={open}
              onClose={() => setOpen(false)}
              label={sheetLabel}
              snapPoints={[1]}
              className="xp-status-sheet [&_.oh-sheet-panel]:overflow-hidden [&_.oh-sheet-panel]:bg-oh-charcoal [&_.oh-sheet-panel]:px-0 [&_.oh-sheet-panel]:pb-0"
            >
              <div data-status-sheet className="flex h-[calc(90svh-44px)] flex-col pb-[env(safe-area-inset-bottom,0px)]">
                <div className="flex items-center justify-between gap-3 px-4 pb-2">
                  <p className="m-0 min-w-0 truncate text-base font-semibold text-oh-cream">{poster}</p>
                  <button
                    type="button"
                    data-status-sheet-close
                    onClick={() => setOpen(false)}
                    aria-label={close}
                    className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-oh-ink p-0 text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                  >
                    {closeIcon}
                  </button>
                </div>
                <iframe data-status-sheet-iframe src={src} title={title} className="block min-h-0 w-full flex-1 border-0 bg-oh-ink" />
              </div>
            </LazySheet>,
            document.body,
          )
        : null}
    </div>
  );
}
