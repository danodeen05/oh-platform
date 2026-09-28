import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { withPlanFallback } from './plan-fallback';
import { createIntlErrorHandlers } from '../lib/site/i18n-errors';

type Messages = Record<string, unknown>;

// One set of handlers per server process, so the production "log once per
// key" set is shared across requests. Client components get the same
// behavior from components/site/IntlClientProvider.tsx.
const intlErrors = createIntlErrorHandlers();

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the locale is supported
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messages = (await import(`../messages/${locale}.json`)).default as Messages;

  return {
    locale,
    messages: withPlanFallback(messages),
    // Task C5: throw in tests; in dev show the key path and log once per key;
    // in production an empty string plus a once-per-key log. Never logged for
    // plan.* (see withPlanFallback).
    onError: intlErrors.onError,
    getMessageFallback: intlErrors.getMessageFallback,
  };
});
