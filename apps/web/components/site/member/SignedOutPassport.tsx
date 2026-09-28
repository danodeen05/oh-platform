"use client";

/**
 * Task D8: /member for a signed-out visitor. A closed passport: the three
 * tier marks, what's inside, Clerk's sign-in and sign-up (modal), and a
 * link to /rewards for how the program works.
 */
import { SignInTrigger, SignUpTrigger } from "@/components/site/auth/AuthTriggers";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { TierMark } from "@/components/site/tiers/TierMark";
import { localizedHref } from "@/lib/site/nav";
import type { PublicProgram } from "@/lib/site/simulate";
import { tierMeta } from "@/lib/site/tier-meta";

export function SignedOutPassport({ program }: { program: PublicProgram | null }) {
  const t = useTranslations("passport.signedOut");
  const locale = useLocale();
  const tiers = program?.tiers ?? [];
  const tones = ["text-oh-cream/60", "text-oh-cream", "text-oh-gold"];

  return (
    <section data-passport-state="signedOut" aria-labelledby="passport-signed-out-title" className="px-4 py-10 md:px-8 md:py-20">
      <div className="mx-auto max-w-xl">
        <div className="mp-cover relative overflow-hidden rounded-[1.75rem] p-6 ring-1 ring-oh-gold/30 md:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-[1.4rem] ring-1 ring-oh-gold/15" />
          <div className="relative">
            <Eyebrow locale={locale} className="text-oh-gold">
              {t("eyebrow")}
            </Eyebrow>
            <div aria-hidden="true" className="mt-6 flex items-end gap-4">
              {tiers.map((tier, i) => (
                <span key={tier.key} className={tones[Math.min(i, tones.length - 1)]}>
                  <TierMark tier={tierMeta(tier.key).mark} tone="current" size={i === tiers.length - 1 ? 60 : 44} />
                </span>
              ))}
            </div>
            <Display id="passport-signed-out-title" locale={locale} className="m-0 mt-6 text-oh-cream">
              {t("title")}
            </Display>
            <Body locale={locale} className="m-0 mt-4 text-oh-cream/80">
              {t("body")}
            </Body>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SignInTrigger>
                <button
                  type="button"
                  data-passport-signin
                  className="inline-flex min-h-12 flex-1 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                >
                  {t("signIn")}
                </button>
              </SignInTrigger>
              <SignUpTrigger>
                <button
                  type="button"
                  className="inline-flex min-h-12 flex-1 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-cream/40 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                >
                  {t("join")}
                </button>
              </SignUpTrigger>
            </div>
          </div>
        </div>
        <Link
          href={localizedHref(locale, "/rewards")}
          data-passport-rewards-link
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-ember-light no-underline hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {t("learn")}
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </section>
  );
}
