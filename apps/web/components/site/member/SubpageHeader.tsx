"use client";

/** Task D8: the heading block for the passport's subpages, with a way back. */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { localizedHref } from "@/lib/site/nav";

export function SubpageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  const t = useTranslations("passport");
  const locale = useLocale();
  return (
    <header>
      <Link
        href={localizedHref(locale, "/member")}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-base text-oh-cream/80 no-underline hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
      >
        <Icon name="chevron" size={18} className="rotate-180" />
        {t("back")}
      </Link>
      <Eyebrow locale={locale} className="mt-4 text-oh-ember-light">
        {eyebrow}
      </Eyebrow>
      <Display locale={locale} className="m-0 mt-3 text-oh-cream">
        {title}
      </Display>
      {lede ? (
        <Body locale={locale} className="m-0 mt-3 text-oh-cream/75">
          {lede}
        </Body>
      ) : null}
    </header>
  );
}
