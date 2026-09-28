/**
 * next-intl error handling (Task C5), kept pure so it can be unit tested.
 * Used on the server by i18n/request.ts and on the client by
 * components/site/IntlClientProvider.tsx, so both sides behave the same.
 *
 * - test: any error throws, so a missing key fails the test that rendered it.
 * - development: the fallback shows the key path on the page; each problem
 *   is logged once per key.
 * - production: a missing or broken message renders as an empty string,
 *   never a raw key path, and is logged once per key (a deduplicated set,
 *   so a hot page can't flood the logs).
 *
 * The business plan (`plan.*`) already falls back to English key by key
 * (withPlanFallback, i18n/plan-fallback.ts), so its errors are never
 * logged outside tests.
 *
 * Which errors are logged where (C5 fix round 1): next-intl calls
 * getMessageFallback, with the exact namespace and key, for every error
 * that concerns one message (the codes in MESSAGE_CODES). Those are logged
 * there, where the plan check is structural. onError only logs the rest
 * (environment and configuration errors), once per message.
 */

export type I18nEnv = "test" | "development" | "production";

export interface IntlErrorLike {
  code?: string;
  message: string;
}

export interface FallbackInfo {
  error: IntlErrorLike;
  key: string;
  namespace?: string;
}

type Logger = (message: string) => void;

export function currentI18nEnv(): I18nEnv {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return "test";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/** Error codes for which next-intl also calls getMessageFallback with the key. */
export const MESSAGE_CODES: ReadonlySet<string> = new Set([
  "MISSING_MESSAGE",
  "INSUFFICIENT_PATH",
  "INVALID_MESSAGE",
  "FORMATTING_ERROR",
]);

function isPlanPath(path: string): boolean {
  return path === "plan" || path.startsWith("plan.");
}

export function createIntlErrorHandlers(env: I18nEnv = currentI18nEnv(), log: Logger = (m) => console.error(m)) {
  const loggedOnce = new Set<string>();

  function logOnce(id: string, message: string) {
    if (loggedOnce.has(id)) return;
    loggedOnce.add(id);
    log(message);
  }

  function onError(error: IntlErrorLike): void {
    if (env === "test") throw error instanceof Error ? error : new Error(error.message);
    // Per-message errors are logged by getMessageFallback, which has the key.
    if (error.code && MESSAGE_CODES.has(error.code)) return;
    logOnce(`${error.code ?? "ERROR"}:${error.message}`, `[i18n] ${error.code ?? "ERROR"}: ${error.message}`);
  }

  function getMessageFallback({ error, key, namespace }: FallbackInfo): string {
    const path = namespace ? `${namespace}.${key}` : key;
    if (!isPlanPath(path)) logOnce(`${error.code ?? "ERROR"}:${path}`, `[i18n] ${error.code ?? "ERROR"}: ${path}`);
    // Test and development show the key path so the gap is visible;
    // production never shows a raw key.
    return env === "production" ? "" : path;
  }

  return { onError, getMessageFallback, loggedOnce };
}
