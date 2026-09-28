"use client";

/**
 * Site footer (Task C4): quiet. The dock covers the main routes on phones,
 * so this carries the brand line, the secondary routes, the legal links and
 * (since 2026-09-28) the One Red Step block that links to /giving.
 *
 * A client component since G2a fix round 1, for a bundling reason: a
 * server-rendered <Link> here made every (site) page resolve next/link's
 * client reference through the home page's chunks, so /member downloaded
 * the home page's 9 KB of JS. Rendered from client code, Link comes from the
 * shell's own chunk. `year` comes from the server so it never differs on
 * hydration.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { FOUNDATION_MARK } from "@/lib/site/foundation";
import { MORE_ITEMS, localizedHref } from "@/lib/site/nav";

const LINK =
  "inline-flex min-h-11 items-center text-sm no-underline text-oh-cream/70 transition-colors hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export function Footer({ year }: { year: number }) {
  const t = useTranslations("site");
  const locale = useLocale();

  return (
    <footer data-site-footer className="border-t border-oh-stone/60 bg-oh-charcoal">
      <div className="mx-auto grid max-w-6xl gap-8 px-[max(1.25rem,env(safe-area-inset-left,0px))] py-10 md:grid-cols-[1fr_auto] md:items-start md:py-14">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- G2a: a pre-sized static file; next/image's client code cost every page 5 KB of JS */}
          <img src="/brand/oh-mark-light-132.webp" alt="" width={44} height={44} loading="lazy" decoding="async" className="h-11 w-11 object-contain opacity-90" />
          <p className="m-0 max-w-xs text-sm leading-relaxed text-oh-cream/70">{t("shell.footer.tagline")}</p>
        </div>

        <nav aria-label={t("shell.footer.nav")}>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-8 p-0 sm:grid-cols-3">
            {MORE_ITEMS.map((item) => (
              <li key={item.key}>
                <Link href={localizedHref(locale, item.href)} className={LINK}>
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={localizedHref(locale, "/privacy")} className={LINK}>
                {t("shell.footer.privacy")}
              </Link>
            </li>
            <li>
              <Link href={localizedHref(locale, "/accessibility")} className={LINK}>
                {t("shell.footer.accessibility")}
              </Link>
            </li>
          </ul>
        </nav>

        {/* One Red Step on every page (the plan's third touchpoint, 2026-09-28). */}
        <section
          data-footer-foundation
          aria-label={t("shell.footer.foundation.label")}
          className="flex items-start gap-4 border-t border-oh-stone/60 pt-8 md:col-span-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- G2a: a pre-sized static file; next/image's client code cost every page 5 KB of JS */}
          <img
            src={FOUNDATION_MARK}
            alt={t("shell.footer.foundation.markAlt")}
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="min-w-0 max-w-xl">
            <p className="m-0 text-sm leading-relaxed text-oh-cream/80">{t("shell.footer.foundation.line")}</p>
            <Link
              href={localizedHref(locale, "/giving")}
              data-footer-giving
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-oh-ember-light no-underline underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("shell.footer.foundation.link")}
              <Icon name="arrow" size={16} />
            </Link>
          </div>
        </section>

        <p className="m-0 text-xs text-oh-mute md:col-span-2">{t("shell.footer.copyright", { year })}</p>
      </div>
    </footer>
  );
}
