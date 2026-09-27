"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { FrameLoader, useIframeLoaded } from "./FrameLoader";

/** The page inside renders at a real phone's CSS size and is scaled to fit the frame. */
const SCREEN_W = 390;
const SCREEN_H = 844;

interface Props {
  src: string;
  title: string;
  /** Tailwind width classes for the whole phone, e.g. "w-[320px]". */
  className?: string;
}

/**
 * A portrait phone drawn in the plan's palette (the sibling of KioskFrame):
 * charcoal body, stone edge, the island, and a screen with real corners.
 * The iframe is laid out at 390 x 844 CSS pixels, exactly like the phone
 * the guest holds, then scaled to the frame's width, so a small phone on
 * the floor plan and a large one on the experience page show the same
 * layout without re-flowing. The ref reaches the iframe for postMessage.
 */
export const PhoneFrame = forwardRef<HTMLIFrameElement, Props>(function PhoneFrame({ src, title, className = "w-[320px]" }, ref) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const { loaded, onLoad, check } = useIframeLoaded(src);
  const iframeRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      check(el);
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref, check],
  );

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SCREEN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`mx-auto max-w-full ${className}`}>
      <div className="relative rounded-[2.6rem] border border-oh-stone bg-[linear-gradient(160deg,#34302B_0%,#1C1B19_55%,#26231F_100%)] p-[10px] shadow-[0_40px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(242,237,228,0.08)]">
        {/* side buttons */}
        <span aria-hidden="true" className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-oh-stone" />
        <span aria-hidden="true" className="absolute -right-[3px] top-[28%] h-14 w-[3px] rounded-r bg-oh-stone" />
        <div ref={screenRef} className="relative overflow-hidden rounded-[2rem] bg-[#E5E5E5] ring-1 ring-oh-stone/70" style={{ aspectRatio: `${SCREEN_W} / ${SCREEN_H}` }}>
          {scale > 0 ? (
            <iframe
              ref={iframeRef}
              src={src}
              title={title}
              loading="lazy"
              onLoad={onLoad}
              className="absolute left-0 top-0 border-0"
              style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
            />
          ) : null}
          <FrameLoader done={loaded} className="w-[34%] max-w-[110px]" />
          {/* the island, over the status bar area */}
          <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[8px] h-[18px] w-[30%] -translate-x-1/2 rounded-full bg-oh-charcoal" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(180deg,rgba(242,237,228,0.05)_0%,rgba(242,237,228,0)_16%)]" />
        </div>
      </div>
      <div aria-hidden="true" className="mx-auto mt-3 h-3 w-[60%] rounded-[50%] bg-black/50 blur-md" />
    </div>
  );
});
