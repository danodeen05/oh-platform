"use client";

/**
 * Task C3 (motion kit): a horizontally scrolling, scroll-snapping rail
 * (menu cards, location cards, etc). This is pure native momentum
 * scrolling plus `scroll-snap-type: x mandatory` (motion.css) -- there is
 * nothing here for reduced motion to disable beyond `scroll-behavior:
 * smooth` (turned off in motion.css's reduced-motion block), since native
 * scroll-snap on touch is not itself an "animation" to suppress.
 */
import type { HTMLAttributes, ReactNode } from "react";
import "./motion.css";

export interface SnapRailProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Accessible name for the carousel region. */
  label?: string;
  className?: string;
}

export function SnapRail({ children, label, className, ...rest }: SnapRailProps) {
  return (
    <div
      {...rest}
      className={["oh-snap-rail", className].filter(Boolean).join(" ")}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      {children}
    </div>
  );
}
