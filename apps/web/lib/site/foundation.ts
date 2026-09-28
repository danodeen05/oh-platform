/**
 * ONE RED STEP AT A TIME (a registered mark): the foundation Oh! gives to,
 * as it publishes itself on oneredstepatatime.org (checked 2026-09-27). One source for the
 * customer site (/giving, the footer, the home chapter, the status screen)
 * and the business plan (components/plan/modules/foundation/contact.ts
 * re-exports this file). Client-safe: plain constants, no plan-model import.
 * The foundation's site lists no email or phone, so none is shown here.
 */
export const FOUNDATION = {
  // U+00AE, the registered sign, as the foundation writes its name. Escaped: the
  // no-emoji scan reads it as a pictograph, but it is a plain text symbol here.
  name: "ONE RED STEP AT A TIME\u00AE",
  /** The name as the customer site writes it (home, footer, /giving): no sign, like the copy. */
  siteName: "ONE RED STEP AT A TIME",
  ein: "33-7041706",
  logo: { src: "/redsock-icon.png", width: 650, height: 650, alt: "One Red Step Foundation" },
  website: "https://www.oneredstepatatime.org",
  donate: "https://www.oneredstepatatime.org/donate",
  store: "https://www.oneredstepatatime.org/store",
  mail: ["PO Box 91", "Centerville, UT 84014"],
  social: [
    { key: "instagram", label: "Instagram", handle: "@oneredstepatatime", url: "https://www.instagram.com/oneredstepatatime/" },
    { key: "facebook", label: "Facebook", handle: "oneredstepatatime", url: "https://www.facebook.com/oneredstepatatime/" },
    { key: "tiktok", label: "TikTok", handle: "@oneredstep", url: "https://www.tiktok.com/@oneredstep" },
    { key: "x", label: "X", handle: "@oneredstep", url: "https://x.com/oneredstep" },
    { key: "youtube", label: "YouTube", handle: "One Red Step", url: "https://www.youtube.com/channel/UCrPvJsHGnufIMFpTa75J-wQ" },
  ],
} as const;

/**
 * The red sock mark pre-sized for the site (120px square WebP, covers 40px
 * at 3x). The 650px PNG above stays the plan's print source.
 */
export const FOUNDATION_MARK = "/brand/redsock-120.webp";

/** The pledge, as a share of revenue from every company restaurant. */
export const FOUNDATION_PLEDGE_PCT = 1;

/** "www.oneredstepatatime.org/donate": a URL as a reader types it, for print. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
