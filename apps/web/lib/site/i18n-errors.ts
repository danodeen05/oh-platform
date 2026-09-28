/**
 * next-intl error handling (Task C5), kept pure so it can be unit tested.
 * Wired into i18n/request.ts.
 *
 * - test: any error throws, so a missing key fails the test that rendered it.
 * - development: logs every error (the fallback shows the key path on the page).
 * - production: a missing message renders as an empty string, never a raw
 *   key, and is logged once per key (a deduplicated set, so a hot page
 *   can't flood the logs). Other errors (bad ICU syntax, formatting) are
 *   logged once per message.
 *
 * The business plan (`plan.*`) already falls back to English key by key
 * (withPlanFallback), so in production its errors are silent: no throw,
 * no log.
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

const MISSING = "MISSING_MESSAGE";

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
    if (env === "development") {
      log(`[i18n] ${error.code ?? "ERROR"}: ${error.message}`);
      return;
    }
    // Production. A missing message is logged by getMessageFallback, which
    // knows the exact key; plan errors are covered by the English fallback.
    if (error.code === MISSING) return;
    if (/`plan\.|\bplan\./.test(error.message)) return;
    logOnce(`${error.code ?? "ERROR"}:${error.message}`, `[i18n] ${error.code ?? "ERROR"}: ${error.message}`);
  }

  function getMessageFallback({ error, key, namespace }: FallbackInfo): string {
    const path = namespace ? `${namespace}.${key}` : key;
    if (env !== "production") return path;
    if (!isPlanPath(path)) logOnce(`${error.code ?? "ERROR"}:${path}`, `[i18n] ${error.code ?? "ERROR"}: ${path}`);
    return "";
  }

  return { onError, getMessageFallback, loggedOnce };
}
