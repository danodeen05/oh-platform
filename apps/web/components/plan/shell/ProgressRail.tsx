"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Scroll-linked reading progress (spec 3.3: linked, not triggered). A
 * one-pixel-tall ember bar across the top of the plan. Motion is driven by
 * scroll position, so reduced-motion users see the same thing without
 * any autonomous animation.
 */
export function ProgressRail({ label }: { label: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  return (
    <motion.div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-oh-ember"
      style={{ scaleX }}
    />
  );
}
