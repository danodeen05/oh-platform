"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks when a same-origin iframe has loaded. An iframe that finishes before
 * hydration never fires React's onLoad, so the ref callback also checks the
 * document directly (skipping the initial about:blank).
 */
export function useIframeLoaded(src: string) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);
  const onLoad = useCallback(() => setLoaded(true), []);
  const check = useCallback((el: HTMLIFrameElement | null) => {
    try {
      if (el?.contentDocument?.readyState === "complete" && el.contentWindow?.location.href !== "about:blank") setLoaded(true);
    } catch {
      // cross-origin: rely on onLoad
    }
  }, []);
  return { loaded, onLoad, check };
}

/**
 * What a device frame's screen shows until its iframe has loaded: the kiosk's
 * ink-brush Oh! mark (a 28 KB, 256 px cut of /kiosk-video.mp4) drawing itself
 * on a loop, small and centered, instead of a blank screen. The clip's white
 * ground is multiplied into the screen color so no box shows around it. It
 * fades out once `done`, then unmounts so the loop stops, and never takes taps.
 */
export function FrameLoader({ done, className = "w-[30%] max-w-[120px]" }: { done: boolean; className?: string }) {
  const [gone, setGone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const hidden = done || timedOut;
  useEffect(() => {
    if (!hidden) {
      setGone(false);
      // failsafe: never leave the loader over a page that did load
      const t = setTimeout(() => setTimedOut(true), 20000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setGone(true), 600);
    return () => clearTimeout(t);
  }, [hidden]);
  if (gone) return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-[#FAF9F6] transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"}`}
    >
      <video
        src="/plan/oh-loader.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={`aspect-square mix-blend-multiply ${className}`}
      />
    </div>
  );
}
