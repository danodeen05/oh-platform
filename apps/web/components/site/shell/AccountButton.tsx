"use client";

/**
 * Account entry in the top bar: the Clerk sign-in modal (through SiteAuth, Task G2a) when signed out, the
 * member page when signed in. Icon-only on phones, labelled from 768px.
 */
import { SignInTrigger, SignedIn, SignedOut } from "@/components/site/auth/AuthTriggers";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { ACCOUNT_ITEM, localizedHref } from "@/lib/site/nav";

const BUTTON =
  "flex h-11 min-w-11 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-transparent px-2.5 font-[inherit] no-underline text-sm text-oh-cream transition-colors hover:bg-oh-stone/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export function AccountButton() {
  const t = useTranslations("site");
  const locale = useLocale();

  return (
    <>
      <SignedOut>
        <SignInTrigger>
          <button type="button" data-site-account="sign-in" className={BUTTON}>
            <Icon name="user" size={22} />
            <span className="sr-only md:not-sr-only">{t("shell.signIn")}</span>
          </button>
        </SignInTrigger>
      </SignedOut>
      <SignedIn>
        <Link data-site-account="member" href={localizedHref(locale, ACCOUNT_ITEM.href)} className={BUTTON}>
          <Icon name={ACCOUNT_ITEM.icon} size={22} />
          <span className="sr-only md:not-sr-only">{t("nav.account")}</span>
        </Link>
      </SignedIn>
    </>
  );
}
