/**
 * Site footer (Task C4): quiet, server-rendered, no client JS. The dock
 * covers the main routes on phones, so this carries the brand line, the
 * secondary routes and the legal links.
 */
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MORE_ITEMS, localizedHref } from "@/lib/site/nav";

const LINK =
  "inline-flex min-h-11 items-center text-sm no-underline text-oh-cream/70 transition-colors hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export async function Footer() {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const year = new Date().getFullYear();

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

        <p className="m-0 text-xs text-oh-mute md:col-span-2">{t("shell.footer.copyright", { year })}</p>
      </div>
    </footer>
  );
}
