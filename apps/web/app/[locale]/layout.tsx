import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
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

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers>
        <LanguageTracker />
        <Header />
        <ActiveOrderBanner />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </Providers>
    </NextIntlClientProvider>
  );
}
