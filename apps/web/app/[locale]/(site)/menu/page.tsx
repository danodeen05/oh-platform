/**
 * /menu (Task D3): the live database menu and prices on linen food panels,
 * grouped by category, each item opening a drag-to-dismiss detail sheet
 * with "Order this". The guest menu is read here on the server
 * (GET /menu/steps?locale=, names and slider labels localized by the API);
 * MenuList asks again with the member's token for early-access items.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { API_URL } from "@/lib/api";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { MenuList } from "@/components/site/menu/MenuList";
import type { ApiMenuStep } from "@/lib/site/menu";

export const dynamic = "force-dynamic";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("menuPage.meta");
  return { title: t("title"), description: t("description") };
}

async function getMenu(locale: string): Promise<ApiMenuStep[] | null> {
  try {
    const res = await fetch(`${API_URL}/menu/steps?locale=${encodeURIComponent(locale)}`, { cache: "no-store", headers: { "x-tenant-slug": "oh" } });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body?.steps) ? body.steps : null;
  } catch {
    return null;
  }
}

export default async function MenuPage() {
  const locale = await getLocale();
  const t = await getTranslations("menuPage");
  const steps = await getMenu(locale);

  return (
    <div data-menu-page className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:pt-14">
      <header className="flex max-w-2xl flex-col gap-3">
        <Eyebrow locale={locale} className="text-oh-gold">
          {t("eyebrow")}
        </Eyebrow>
        <Display locale={locale} className="m-0 text-oh-cream">
          {t("title")}
        </Display>
        <Body locale={locale} className="m-0 text-oh-cream/80">
          {t("lede")}
        </Body>
      </header>

      {steps ? (
        <MenuList initialSteps={steps} />
      ) : (
        <div role="alert" data-menu-error className="mt-8 rounded-3xl bg-oh-ink p-6">
          <p className="m-0 text-lg font-semibold text-oh-cream">{t("error.title")}</p>
          <p className="m-0 mt-1 text-[15px] text-oh-mute">{t("error.body")}</p>
          <a href={`/${locale}/menu`} className={`mt-4 inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline ${FOCUS}`}>
            {t("error.retry")}
          </a>
        </div>
      )}

      <Reveal as="section" aria-labelledby="menu-cta" className="mt-14 flex flex-col items-start gap-4 border-t border-oh-stone pt-10 md:mt-20 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-xl flex-col gap-2">
          <Title locale={locale} id="menu-cta" className="m-0 text-oh-cream">
            {t("cta.title")}
          </Title>
          <Body locale={locale} className="m-0 text-oh-mute">
            {t("cta.body")}
          </Body>
        </div>
        <Link href={`/${locale}/order`} data-menu-order className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline ${FOCUS}`}>
          {t("cta.button")}
          <Icon name="arrow" size={18} />
        </Link>
      </Reveal>
    </div>
  );
}
