import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, zhTW, zhCN, esES } from "@clerk/localizations";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/Providers";
import { IntlClientProvider } from "@/components/site/IntlClientProvider";
import { SERVER_ONLY_NAMESPACES, omitNamespaces } from "@/lib/site/client-messages";
import LanguageTracker from "@/components/LanguageTracker";
import { LangSync } from "@/components/plan/shell/LangSync";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Map app locales to Clerk localizations
const clerkLocalizations: Record<string, typeof enUS> = {
  en: enUS,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  es: esES,
};

// Task G2a: (site), legacy, agents and kiosk-unauthorized pages get their
// messages from their own layouts (components/site/ScopedIntl.tsx).
const GROUP_SCOPED = {};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the current locale
  const messages = await getMessages();

  // Get Clerk localization for the current locale
  const clerkLocalization = clerkLocalizations[locale] || enUS;

  // Check if this is a kiosk or CNY route - these have their own layout without header/footer
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isKioskRoute = pathname.includes("/kiosk");
  const isCNYRoute = pathname.includes("/cny");
  // The interactive business plan has its own shell (see app/[locale]/plan)
  const isPlanRoute = /\/plan(\/|$)/.test(pathname);

  // The plan is gated by its own cookie and never touches Clerk on the client,
  // so it skips ClerkProvider and the clerk-js download (spec 7.3 budget).
  if (isPlanRoute) {
    return (
      <NextIntlClientProvider messages={messages}>
        <IntlClientProvider>
          <LangSync locale={locale} />
          {children}
        </IntlClientProvider>
      </NextIntlClientProvider>
    );
  }

  // An embedded order status page (the business plan's phone demo): the page
  // alone, no header, footer or chat widget. Middleware sets x-embed.
  if (headersList.get("x-embed") === "1") {
    return (
      <ClerkProvider localization={clerkLocalization}>
        <NextIntlClientProvider messages={GROUP_SCOPED}>
          <IntlClientProvider>
            <Providers>
              <LangSync locale={locale} />
              {children}
            </Providers>
          </IntlClientProvider>
        </NextIntlClientProvider>
      </ClerkProvider>
    );
  }

  // For kiosk and CNY routes, render without header/footer
  if (isKioskRoute || isCNYRoute) {
    return (
      <ClerkProvider localization={clerkLocalization}>
        <NextIntlClientProvider messages={omitNamespaces(messages, SERVER_ONLY_NAMESPACES) as typeof messages}>
          <IntlClientProvider>
            <LangSync locale={locale} />
            {children}
          </IntlClientProvider>
        </NextIntlClientProvider>
      </ClerkProvider>
    );
  }

  // Everything else. The chrome is no longer shared here (Task C4 layout
  // split): the `(legacy)` group renders the old Header, ActiveOrderBanner,
  // Footer and floating Chappy (components/legacy/LegacyChrome.tsx), and the
  // `(site)` group renders SiteShell. Nothing here wraps {children} in
  // `.legacy-ui`, so rebuilt routes never inherit legacy styling.
  //
  // Task G2a: no messages are serialized here. This layout is shared by
  // (site) and legacy pages and is not re-rendered on a client navigation
  // between them, so each group's layout provides its own set (ScopedIntl in
  // (site)/layout.tsx and LegacyChrome); the client components rendered
  // here (Providers, LanguageTracker, LangSync) read none.
  return (
    <ClerkProvider localization={clerkLocalization}>
      <NextIntlClientProvider messages={GROUP_SCOPED}>
        <IntlClientProvider>
          <Providers>
            <LangSync locale={locale} />
            <LanguageTracker />
            {children}
          </Providers>
        </IntlClientProvider>
      </NextIntlClientProvider>
    </ClerkProvider>
  );
}
