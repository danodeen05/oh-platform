/**
 * ONE RED STEP AT A TIME®: the foundation Oh! gives to, as it publishes
 * itself on oneredstepatatime.org (checked 2026-09-27). One source for the
 * plan panel, the Team card and print. The site lists no email or phone, so
 * none is shown here.
 */
export const FOUNDATION = {
  name: "ONE RED STEP AT A TIME®",
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

/** "www.oneredstepatatime.org/donate": a URL as a reader types it, for print. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
