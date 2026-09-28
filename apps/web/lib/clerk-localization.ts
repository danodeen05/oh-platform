/**
 * Clerk UI localizations per app locale, for the server-rendered
 * <ClerkProvider>s (app/[locale]/layout.tsx for kiosk and CNY, and
 * components/legacy/LegacyChrome.tsx). The (site) pages load theirs with
 * Clerk itself, after first paint (components/site/auth/ClerkBridge.tsx).
 */
import { enUS, esES, zhCN, zhTW } from "@clerk/localizations";

const CLERK_LOCALIZATIONS: Record<string, typeof enUS> = {
  en: enUS,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  es: esES,
};

export function clerkLocalizationFor(locale: string): typeof enUS {
  return CLERK_LOCALIZATIONS[locale] ?? enUS;
}
