"use client";
import { useState, useEffect } from "react";

// Base design is 720p, scale up for larger screens
const BASE_HEIGHT = 720;
const MAX_SCALE = 1.5; // Cap at 1080p (1080/720 = 1.5)

/**
 * Hook for responsive kiosk scaling between 720p and 1080p resolutions.
 *
 * Base design is 720p (1280x720). At 1080p (1920x1080), elements scale up by 1.5x.
 *
 * Usage:
 * ```tsx
 * const { s, rem, scale } = useKioskScale();
 *
 * // Scale pixel values
 * <div style={{ width: s(100), height: s(50) }} />
 *
 * // Scale rem values
 * <div style={{ fontSize: rem(1.5) }} />
 * ```
 */
export function useKioskScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const newScale = window.innerHeight / BASE_HEIGHT;
      // Clamp between 1 (720p) and MAX_SCALE (1080p)
      setScale(Math.max(1, Math.min(newScale, MAX_SCALE)));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return {
    /** Current scale factor (1.0 at 720p, 1.5 at 1080p) */
    scale,
    /** Scale a pixel value. Returns number for use in style objects. */
    s: (px: number) => Math.round(px * scale),
    /** Scale a rem value. Returns string like "1.5rem" for fontSize. */
    rem: (base: number) => `${(base * scale).toFixed(3)}rem`,
    /** Whether we're at the larger (1080p) resolution */
    isLarge: scale >= 1.4,
    /** Whether we're at the smaller (720p) resolution */
    isSmall: scale < 1.1,
  };
}

/**
 * CSS custom property for use in stylesheets.
 * Add to :root and use with calc():
 *
 * ```css
 * :root { --kiosk-scale: 1; }
 * @media (min-height: 900px) { :root { --kiosk-scale: 1.5; } }
 * .btn { width: calc(100px * var(--kiosk-scale)); }
 * ```
 */
export const KIOSK_SCALE_CSS_VAR = "--kiosk-scale";
