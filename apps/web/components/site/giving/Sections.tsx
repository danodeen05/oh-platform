/**
 * /giving, sections 2 to 7 (spec 2026-09-28 section 3a): the pledge, the
 * foundation, how a visit helps, red socks, the actions and the contact line.
 *
 * Facts come from lib/site/foundation.ts (shared with the business plan) and
 * copy adapted from `plan.foundation.*`. Deliberately absent: the plan's
 * dollar projections (NDA-gated investor figures) and its related-party
 * disclosure (investor material; the owner can ask for it).
 *
 * Every external link opens in a new tab with rel="noopener noreferrer" and
 * says so to screen readers. Addresses, handles and URLs carry
 * translate="no": they read the same in every language on purpose.
 */
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Icon, type IconName } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { FOUNDATION, FOUNDATION_PLEDGE_PCT, displayUrl } from "@/lib/site/foundation";
import { AskChappyButton } from "./AskChappy";

const SECTION = "px-5 py-16 md:px-8 md:py-24";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-7 text-base font-semibold text-oh-cream no-underline shadow-[0_12px_32px_-14px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember ${FOCUS}`;
const OUTLINE = `inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-cream hover:bg-oh-cream/10 ${FOCUS}`;
const QUIET = `inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-oh-ember-light no-underline underline-offset-4 hover:underline ${FOCUS}`;

function serifClass(locale: string): string {
  return locale.startsWith("zh") ? "font-display-cjk" : "font-display";
}

/** An external link: new tab, no opener, and a screen-reader note that it opens one. */
function External({ href, newTab, className, children, ...rest }: { href: string; newTab: string; className: string; children: ReactNode } & Record<`data-${string}`, string | boolean>) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {children}
      <span className="sr-only">{` (${newTab})`}</span>
    </a>
  );
}

export async function Pledge({ locale }: { locale: string }) {
  const t = await getTranslations("giving.pledge");
  return (
    <section data-giving-section="pledge" aria-labelledby="giving-pledge" className={`${SECTION} border-t border-oh-stone/60`}>
      <Reveal className="mx-auto max-w-6xl">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        {/* The body sits under the lede on wide screens: the heading is a subgrid row of the same grid. */}
        <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr] md:gap-x-14">
          <h2 id="giving-pledge" className="m-0 grid gap-4 font-normal md:col-span-2 md:grid-cols-subgrid md:items-end md:gap-x-14">
            <span data-giving-pct={FOUNDATION_PLEDGE_PCT} className={`${serifClass(locale)} block text-[clamp(5.5rem,34vw,12rem)] leading-[0.85] text-oh-ember-light`}>
              {t("figure")}
            </span>
            <span className={`${serifClass(locale)} block max-w-xl text-[clamp(1.6rem,6.4vw,2.6rem)] leading-[1.15] text-oh-cream [text-wrap:balance] md:pb-3`}>
              {t("lede")}
            </span>
          </h2>
          <Body locale={locale} className="m-0 max-w-xl text-lg text-oh-cream/85 md:col-start-2">
            {t("body")}
          </Body>
        </div>
      </Reveal>
    </section>
  );
}

export async function Foundation({ locale }: { locale: string }) {
  const t = await getTranslations("giving.foundation");
  return (
    <section data-giving-section="foundation" aria-labelledby="giving-foundation" className={`${SECTION} bg-oh-ink`}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="giving-foundation" locale={locale} className="m-0 mt-3 text-oh-cream [overflow-wrap:anywhere]">
            {FOUNDATION.siteName}
          </Title>
          <Body locale={locale} className="m-0 mt-2 text-lg text-oh-cream/85">
            {t("kind")}
          </Body>
        </Reveal>
        <Reveal as="figure" className="m-0 mt-10 max-w-3xl border-l-2 border-oh-ember pl-5 md:ml-24 md:pl-8">
          <blockquote className={`m-0 ${serifClass(locale)} text-[clamp(1.35rem,5.2vw,2rem)] leading-snug text-oh-cream`}>{t("mission")}</blockquote>
          <figcaption className="mt-4 text-sm text-oh-mute">{t("missionSource")}</figcaption>
        </Reveal>
        <Body locale={locale} data-giving-identity className="m-0 mt-10 max-w-3xl text-oh-cream/80 md:ml-24">
          {t("identity", { ein: FOUNDATION.ein })}
        </Body>
      </div>
    </section>
  );
}

const VISIT_ITEMS: ReadonlyArray<{ key: "noTip" | "status" | "gifts"; icon: IconName }> = [
  { key: "noTip", icon: "bowl" },
  { key: "status", icon: "spark" },
  { key: "gifts", icon: "gift" },
];

export async function Visit({ locale }: { locale: string }) {
  const t = await getTranslations("giving.visit");
  return (
    <section data-giving-section="visit" aria-labelledby="giving-visit" className={SECTION}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="giving-visit" locale={locale} className="m-0 mt-3 text-oh-cream [text-wrap:balance]">
            {t("title")}
          </Title>
        </Reveal>
        <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
          {VISIT_ITEMS.map(({ key, icon }) => (
            <li key={key} data-giving-visit={key} className="rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-6 md:p-7">
              <Icon name={icon} size={28} className="text-oh-ember-light" />
              <h3 className="m-0 mt-4 text-xl font-semibold leading-snug text-oh-cream">{t(`items.${key}.title`)}</h3>
              <p className="m-0 mt-2 text-base leading-relaxed text-oh-cream/80">{t(`items.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export async function Socks({ locale }: { locale: string }) {
  const t = await getTranslations("giving");
  return (
    <section data-giving-section="socks" aria-labelledby="giving-socks" className={`${SECTION} border-t border-oh-stone/60`}>
      <Reveal className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:gap-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- G2a: a static file, no next/image on (site) pages */}
        <img
          src={FOUNDATION.logo.src}
          alt=""
          width={FOUNDATION.logo.width}
          height={FOUNDATION.logo.height}
          loading="lazy"
          decoding="async"
          className="h-32 w-32 shrink-0 object-contain md:h-48 md:w-48"
        />
        <div className="max-w-xl">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("socks.eyebrow")}
          </Eyebrow>
          <Title id="giving-socks" locale={locale} className="m-0 mt-3 text-oh-cream [text-wrap:balance]">
            {t("socks.title")}
          </Title>
          <Body locale={locale} className="m-0 mt-4 text-lg text-oh-cream/85">
            {t("socks.body")}
          </Body>
          <External href={FOUNDATION.store} newTab={t("newTab")} className={`${QUIET} mt-5`} data-giving-store>
            {t("socks.store")}
            <Icon name="arrow" size={18} />
          </External>
        </div>
      </Reveal>
    </section>
  );
}

export async function Actions({ locale }: { locale: string }) {
  const t = await getTranslations("giving");
  return (
    <section data-giving-section="actions" aria-labelledby="giving-actions" className={`${SECTION} bg-oh-ink`}>
      <Reveal className="mx-auto max-w-6xl">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("actions.eyebrow")}
        </Eyebrow>
        <Title id="giving-actions" locale={locale} className="m-0 mt-3 text-oh-cream [text-wrap:balance]">
          {t("actions.title")}
        </Title>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <External href={FOUNDATION.donate} newTab={t("newTab")} className={PRIMARY} data-giving-donate>
            {t("actions.donate")}
            <Icon name="arrow" size={18} />
          </External>
          <External href={FOUNDATION.website} newTab={t("newTab")} className={OUTLINE} data-giving-visit-foundation>
            {t("actions.visit")}
          </External>
          <AskChappyButton label={t("actions.chappy")} prompt={t("actions.chappyPrompt")} className={OUTLINE} />
        </div>
        <Body locale={locale} className="m-0 mt-4 text-sm text-oh-mute">
          {t("actions.donateNote")}
        </Body>
      </Reveal>
    </section>
  );
}

export async function Contact({ locale }: { locale: string }) {
  const t = await getTranslations("giving");
  const LINK = `inline-flex min-h-11 items-center text-base text-oh-cream/85 no-underline underline-offset-4 hover:text-oh-cream hover:underline ${FOCUS}`;
  return (
    <section data-giving-section="contact" aria-labelledby="giving-contact" className="px-5 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 id="giving-contact" className="m-0 text-xl font-semibold text-oh-cream">
          {t("contact.title")}
        </h2>
        <dl className="m-0 mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.2em] text-oh-mute">{t("contact.website")}</dt>
            <dd className="m-0 mt-1">
              <External href={FOUNDATION.website} newTab={t("newTab")} className={LINK}>
                <span translate="no">{displayUrl(FOUNDATION.website)}</span>
              </External>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.2em] text-oh-mute">{t("contact.mail")}</dt>
            <dd className="m-0 mt-1 text-base leading-relaxed text-oh-cream/85">
              <address translate="no" className="not-italic">
                {FOUNDATION.mail.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.2em] text-oh-mute">{t("contact.social")}</dt>
            <dd className="m-0 mt-1">
              <ul className="m-0 flex list-none flex-wrap gap-x-5 p-0">
                {FOUNDATION.social.map((s) => (
                  <li key={s.key}>
                    <External href={s.url} newTab={t("newTab")} className={LINK}>
                      <span translate="no">{s.label}</span>
                    </External>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
