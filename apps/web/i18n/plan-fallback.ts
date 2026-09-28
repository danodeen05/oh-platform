import en from '../messages/en.json';

type Messages = Record<string, unknown>;

/**
 * The interactive business plan (`plan.*`) ships complete in en and zh-TW.
 * Other locales fall back to English key by key so a missing translation
 * never renders a raw key or throws in front of an investor.
 *
 * Moved out of i18n/request.ts unchanged (C5 fix round 1) so a test can pin
 * that the client-side missing-key handler never blanks plan text that
 * exists through this fallback.
 */
export function withPlanFallback(messages: Messages): Messages {
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
