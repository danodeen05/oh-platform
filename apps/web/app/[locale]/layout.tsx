import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, zhTW, zhCN, esES } from "@clerk/localizations";
import { routing } from "@/i18n/routing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ActiveOrderBanner from "@/components/ActiveOrderBanner";
import { Providers } from "@/components/Providers";
import LanguageTracker from "@/components/LanguageTracker";

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

  // Check if this is a kiosk route - kiosk has its own layout without header/footer
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isKioskRoute = pathname.includes("/kiosk");

  // For kiosk routes, render without header/footer
  if (isKioskRoute) {
    return (
      <ClerkProvider localization={clerkLocalization}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider localization={clerkLocalization}>
      <NextIntlClientProvider messages={messages}>
        <Providers>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <LanguageTracker />
            <Header />
            <ActiveOrderBanner />
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
          </div>
        </Providers>
      </NextIntlClientProvider>
    </ClerkProvider>
  );
}
