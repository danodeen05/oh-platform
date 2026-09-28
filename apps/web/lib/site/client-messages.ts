/**
 * Which message namespaces reach the browser (Task G2a).
 *
 * NextIntlClientProvider serializes every message it is given into the page
 * (the RSC payload inlined in the HTML). The [locale] layout used to hand it
 * the whole catalog, about 180 KB of JSON in English, more than half of it
 * the business plan's `plan.*`, on every page. Now:
 *
 * - `(site)` pages get only SITE_CLIENT_NAMESPACES, the namespaces their
 *   client components read. `client-messages.test.ts` walks the import graph
 *   of app/[locale]/(site) and fails if a client component there uses a
 *   namespace missing from this list, so a new one can't silently render
 *   blank (production shows "" for a missing key).
 * - legacy pages (and kiosk, CNY, agents) get everything except
 *   SERVER_ONLY_NAMESPACES.
 * - the plan keeps its full catalog (its own branch in the [locale] layout).
 *
 * Server components are unaffected: getTranslations reads the full catalog
 * from i18n/request.ts on the server.
 */

type Messages = Record<string, unknown>;

export const SITE_CLIENT_NAMESPACES = ["site", "siteImages", "home", "rewards", "loyalty", "passport"] as const;

/** Never needed by a client component outside the plan. */
export const SERVER_ONLY_NAMESPACES = ["plan"] as const;

export function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = {};
  for (const ns of namespaces) if (ns in messages) out[ns] = messages[ns];
  return out;
}

export function omitNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = { ...messages };
  for (const ns of namespaces) delete out[ns];
  return out;
}
