/**
 * The part of Google Analytics every page needs (Task G2a fix round 1): the
 * measurement id, page views and a "when gtag is ready" helper. Split from
 * lib/analytics.ts so the root <GoogleAnalytics> (in every page's first-load
 * JS) doesn't pull in the whole event catalog.
 *
 * gtag loads `lazyOnload` (after the page's load event), so calls made
 * before then are queued, not dropped.
 */

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    /** The first path this tab showed, reported by the inline config (GoogleAnalytics.tsx). */
    __ohLandingPath?: string;
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const waiting: Array<() => void> = [];
let polling = false;

/** Runs `fn` now if gtag is loaded, otherwise once it is (checked every 100 ms). */
export function whenGtag(fn: () => void): void {
  if (typeof window === "undefined") return;
  if (window.gtag) {
    fn();
    return;
  }
  waiting.push(fn);
  if (polling) return;
  polling = true;
  const check = () => {
    if (!window.gtag) {
      setTimeout(check, 100);
      return;
    }
    polling = false;
    while (waiting.length) waiting.shift()!();
  };
  setTimeout(check, 100);
}

/** A client-side page view (the landing page is reported by the inline config). */
export const pageview = (url: string) => {
  if (!GA_MEASUREMENT_ID) return;
  whenGtag(() => window.gtag("config", GA_MEASUREMENT_ID, { page_path: url }));
};
