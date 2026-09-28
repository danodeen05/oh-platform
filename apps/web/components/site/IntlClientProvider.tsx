"use client";

/**
 * Client-side missing-key handling (Task C5 fix round 1).
 *
 * The server's `onError`/`getMessageFallback` (i18n/request.ts) are
 * functions, so they can't cross into client components: the server
 * NextIntlClientProvider only serializes the locale, messages, time zone and
 * the like. Without this wrapper a client `useTranslations` miss would use
 * next-intl's default and render the raw key path in production.
 *
 * It sits just inside the server NextIntlClientProvider in every branch of
 * app/[locale]/layout.tsx, reads what that provider already set up (locale,
 * messages, time zone, now) and re-provides it with the same handlers the server
 * uses (lib/site/i18n-errors.ts): throw in tests, key path plus a
 * once-per-key log in dev, an empty string plus a once-per-key log in
 * production. Messages pass through untouched, so plan text that exists
 * through withPlanFallback still renders; only true misses are affected.
 */
import { NextIntlClientProvider, useLocale, useMessages, useNow, useTimeZone } from "next-intl";
import { useMemo, type ReactNode } from "react";
import { createIntlErrorHandlers, currentI18nEnv, type I18nEnv } from "@/lib/site/i18n-errors";

// One set per browser tab (module scope), so "once per key" holds across
// client navigations, not just one render.
let sharedHandlers: ReturnType<typeof createIntlErrorHandlers> | null = null;

function handlersFor(env: I18nEnv | undefined) {
  if (env) return createIntlErrorHandlers(env);
  sharedHandlers ??= createIntlErrorHandlers(currentI18nEnv());
  return sharedHandlers;
}

export function IntlClientProvider({ children, env }: { children: ReactNode; /** Tests only. */ env?: I18nEnv }) {
  const locale = useLocale();
  const messages = useMessages();
  const timeZone = useTimeZone();
  // The request's fixed "now" from the server provider (keeps relative times hydration-stable).
  const now = useNow();
  const handlers = useMemo(() => handlersFor(env), [env]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
      now={now}
      onError={handlers.onError}
      getMessageFallback={handlers.getMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
