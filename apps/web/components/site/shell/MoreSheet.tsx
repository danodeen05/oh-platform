"use client";

/**
 * The More sheet (C3's Sheet: drag to dismiss, focus trap, Esc, iOS scroll
 * lock): the secondary routes, the account entry and the language switch.
 * Phones open it from the top bar; 768 to 1279px from the desktop nav's
 * More button.
 */
import { SignInTrigger, SignedIn, SignedOut } from "@/components/site/auth/AuthTriggers";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Sheet } from "@/components/site/motion/Sheet";
import { ACCOUNT_ITEM, MORE_ITEMS, isNavActive, localizedHref } from "@/lib/site/nav";
import { LocaleSwitch } from "./LocaleSwitch";

const ROW =
  "flex min-h-13 w-full cursor-pointer appearance-none items-center gap-4 rounded-xl border-0 bg-transparent px-3 font-[inherit] no-underline text-left text-base text-oh-cream transition-colors hover:bg-oh-stone/50 aria-[current=page]:bg-oh-stone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

// Night palette for the (paper by default) motion-kit sheet.
const NIGHT =
  "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]";

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const cjk = locale.startsWith("zh");

  return (
    <Sheet open={open} onClose={onClose} label={t("shell.more")} className={NIGHT}>
      <div data-site-more-sheet className={cjk ? "font-cjk" : "font-body"}>
        <div className="-mt-2 mb-2 flex items-center justify-between">
          <h2 className={`${cjk ? "font-display-cjk" : "font-display"} m-0 text-3xl font-normal text-oh-cream`}>{t("shell.more")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-oh-cream/80 hover:bg-oh-stone/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
          >
            <Icon name="close" size={22} title={t("shell.close")} />
          </button>
        </div>

        <nav aria-label={t("shell.more")}>
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {MORE_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={localizedHref(locale, item.href)}
                  aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
                  onClick={onClose}
                  className={ROW}
                >
                  <Icon name={item.icon} size={22} className="shrink-0 text-oh-ember-light" />
                  <span className="min-w-0 flex-1 truncate">{t(`nav.${item.key}`)}</span>
                  <Icon name="chevron" size={18} className="shrink-0 text-oh-ash" />
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-oh-stone/70 pt-1">
              <SignedOut>
                <SignInTrigger>
                  <button type="button" onClick={onClose} className={ROW}>
                    <Icon name="user" size={22} className="shrink-0 text-oh-ember-light" />
                    <span className="min-w-0 flex-1 truncate">{t("shell.signIn")}</span>
                    <Icon name="chevron" size={18} className="shrink-0 text-oh-ash" />
                  </button>
                </SignInTrigger>
              </SignedOut>
              <SignedIn>
                <Link
                  href={localizedHref(locale, ACCOUNT_ITEM.href)}
                  aria-current={isNavActive(pathname, ACCOUNT_ITEM.href) ? "page" : undefined}
                  onClick={onClose}
                  className={ROW}
                >
                  <Icon name={ACCOUNT_ITEM.icon} size={22} className="shrink-0 text-oh-ember-light" />
                  <span className="min-w-0 flex-1 truncate">{t("nav.account")}</span>
                  <Icon name="chevron" size={18} className="shrink-0 text-oh-ash" />
                </Link>
              </SignedIn>
            </li>
          </ul>
        </nav>

        <section className="mt-6">
          <h3 className="m-0 mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">
            <Icon name="globe" size={16} />
            {t("shell.language")}
          </h3>
          <LocaleSwitch variant="list" onSwitched={onClose} />
        </section>
      </div>
    </Sheet>
  );
}
