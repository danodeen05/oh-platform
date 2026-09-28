/**
 * Site follow-up 2026-09-28 (spec section 3a): /giving, One Red Step At A
 * Time. The business plan's giving pledge told for guests, in seven short
 * sections on a phone scroll:
 *
 *   1. Hero          the red thread, "Every visit is one more step.", the vision
 *   2. The pledge    1% of revenue from every company restaurant, its own budget line
 *   3. The foundation  mission, Utah mental health nonprofit, 501(c)(3), EIN
 *   4. Your visit    no tip, the status-screen fact, gifts go straight to it
 *   5. Red socks     the easy way to join in, with the foundation store
 *   6. Actions       Donate, Visit the foundation, Ask Chappy
 *   7. Contact       website, mail address, social links
 *
 * No dollar projections (the plan's figures are NDA-gated) and no
 * related-party disclosure (investor material). Server-rendered; the only
 * client islands are the Reveal wrappers and the Ask Chappy button.
 */
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { GivingHero } from "@/components/site/giving/Hero";
import { Actions, Contact, Foundation, Pledge, Socks, Visit } from "@/components/site/giving/Sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("giving.meta");
  return { title: t("title"), description: t("description") };
}

export default async function GivingPage() {
  const locale = await getLocale();
  return (
    <div data-giving-page className="overflow-x-clip bg-oh-charcoal">
      <GivingHero locale={locale} />
      <Pledge locale={locale} />
      <Foundation locale={locale} />
      <Visit locale={locale} />
      <Socks locale={locale} />
      <Actions locale={locale} />
      <Contact locale={locale} />
    </div>
  );
}
