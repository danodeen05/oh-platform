import type { MetadataRoute } from "next";

/**
 * The interactive business plan is invitation-only and must never be indexed
 * (spec 7.7). Everything else stays crawlable as before (no robots file
 * existed previously, which is equivalent to allow-all).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: ["/plan", "/*/plan", "/*/plan/", "/api/plan"] },
    ],
  };
}
