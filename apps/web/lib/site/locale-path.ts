/**
 * Locale switching for the site shell (Task C4). Pure so it can be unit
 * tested: swap only the locale segment, keep the rest of the path, the query
 * and the hash exactly as they were.
 */
import { locales, type Locale } from "@/i18n/config";

function isLocale(segment: string): segment is Locale {
  return (locales as readonly string[]).includes(segment);
}

export function swapLocalePath(pathname: string, search: string, target: Locale, hash = ""): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) segments.shift();
  const path = `/${[target, ...segments].join("/")}`;

  const query = search.replace(/^\?/, "");
  const fragment = hash.replace(/^#/, "");
  return `${path}${query ? `?${query}` : ""}${fragment ? `#${fragment}` : ""}`;
}
