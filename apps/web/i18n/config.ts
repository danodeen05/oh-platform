export const locales = ['en', 'zh-TW', 'zh-CN', 'es'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  'en': 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'es': 'Español',
};
