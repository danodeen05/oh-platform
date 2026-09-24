import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import en from '../messages/en.json';

type Messages = Record<string, unknown>;

/**
 * The interactive business plan (`plan.*`) ships complete in en and zh-TW.
 * Other locales fall back to English key by key so a missing translation
 * never renders a raw key or throws in front of an investor.
 */
function withPlanFallback(messages: Messages): Messages {
  const enPlan = (en as Messages).plan as Messages | undefined;
  const localePlan = (messages.plan as Messages | undefined) ?? {};
  if (!enPlan) return messages;
  return { ...messages, plan: deepMerge(enPlan, localePlan) };
}

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (isRecord(value) && isRecord(current)) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isRecord(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
  };
});
