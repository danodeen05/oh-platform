"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";

/**
 * Scroll-linked reading progress (spec 3.3: linked, not triggered). A
 * one-pixel-tall ember bar across the top of the plan. Motion is driven by
 * scroll position, so reduced-motion users see the same thing without
 * any autonomous animation. aria-valuenow follows the scroll, rounded to
 * whole percent so screen readers are not chattered at.
 */
export function ProgressRail({ label }: { label: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  const [percent, setPercent] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setPercent(Math.round(Math.min(1, Math.max(0, v)) * 100)));
  useEffect(() => setPercent(Math.round(scrollYProgress.get() * 100)), [scrollYProgress]);
  return (
    <motion.div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-oh-ember"
      style={{ scaleX }}
    />
  );
}
