"use client";

/**
 * Chappy on phones (below 768px): the C3 motion-kit Sheet (drag to dismiss,
 * focus trap, Esc, iOS-safe scroll lock), full screen.
 *
 * Keyboard: the sheet's root tracks window.visualViewport (height and
 * offsetTop, see chappy.css), so when the on-screen keyboard opens the sheet
 * shrinks to the space above it and the composer, the sheet's last row,
 * stays visible instead of hiding behind the keyboard.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Sheet } from "@/components/site/motion/Sheet";

function readViewport() {
  if (typeof window === "undefined") return null;
  const vv = window.visualViewport;
  return { h: Math.round(vv ? vv.height : window.innerHeight), top: Math.round(vv ? vv.offsetTop : 0) };
}

export function useVisualViewport(active: boolean) {
  const [vp, setVp] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVp(readViewport()));
    };
    setVp(readViewport());
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);
  return vp;
}

export function ChappySheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const vp = useVisualViewport(open);
  const style = (vp ? { "--chappy-vvh": `${vp.h}px`, "--chappy-vvt": `${vp.top}px` } : {}) as CSSProperties;
  return (
    <div data-chappy-surface="sheet" style={style}>
      <Sheet open={open} onClose={onClose} label={label} className="chappy-sheet">
        {children}
      </Sheet>
    </div>
  );
}
