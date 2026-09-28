/**
 * Task D7: /rewards, the membership showpiece (replaces the legacy
 * /loyalty page; next.config 308s the old URL here).
 *
 * The owner's rule: the member benefits pages get the most love, and a new
 * visitor learns exactly how to reach the top rank. So the page walks the
 * climb, flips open each tier's perks, lets you simulate your own path to
 * Beef Boss, and explains credits, referrals, seals, challenges and the
 * fine print.
 *
 * Data: the program (GET /membership/program, revalidated hourly) plus the
 * badge and challenge catalogs (localized with ?locale=), fetched here on
 * the server and handed to the client islands. Nothing about the program is
 * hard-coded. A signed-in member's own position comes from
 * RewardsMemberProvider (GET /users/:id/profile) on the client; the page is
 * fully useful signed out.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { AskChappy } from "@/components/site/rewards/AskChappy";
import { Climb } from "@/components/site/rewards/Climb";
import { CreditTimeline } from "@/components/site/rewards/CreditTimeline";
import { formatMoney } from "@/components/site/rewards/format";
import { MemberStatus } from "@/components/site/rewards/MemberStatus";
import { PathSimulator } from "@/components/site/rewards/PathSimulator";
import { ReferralPanel } from "@/components/site/rewards/ReferralPanel";
import { RewardsMemberProvider } from "@/components/site/rewards/RewardsMember";
import { SealGallery, type GallerySeal } from "@/components/site/rewards/SealGallery";
import { TierCards } from "@/components/site/rewards/TierCards";
import { Seal } from "@/components/site/seal/Seal";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { TierMark } from "@/components/site/tiers/TierMark";
import { localizedHref } from "@/lib/site/nav";
import { getBadges, getChallenges, getProgram, localizedCopy, tierMeta, type PublicProgram } from "@/lib/site/program";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rewards.meta");
  return { title: t("title"), description: t("description") };
}

function Section({
  id,
  locale,
  eyebrow,
  title,
  lede,
  children,
  className = "",
}: {
  id: string;
  locale: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-20 px-5 py-16 md:px-8 md:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {eyebrow}
          </Eyebrow>
          <Title id={`${id}-title`} locale={locale} className="m-0 mt-3 max-w-3xl text-oh-cream">
            {title}
          </Title>
          {lede ? (
            <Body locale={locale} className="m-0 mt-4 max-w-2xl text-oh-cream/75">
              {lede}
            </Body>
          ) : null}
        </Reveal>
        <div className="mt-10 md:mt-14">{children}</div>
      </div>
    </section>
  );
}

function faqValues(program: PublicProgram, name: (key: string) => string) {
  const [a, b, c] = program.tiers;
  const top = program.tiers[program.tiers.length - 1];
  return {
    climb: {
      first: name(a.key),
      second: name(b?.key ?? a.key),
      third: name(c?.key ?? top.key),
      firstOrders: a.need?.orders ?? 0,
      firstReferrals: a.need?.referrals ?? 0,
      secondOrders: b?.need?.orders ?? 0,
      secondReferrals: b?.need?.referrals ?? 0,
    },
    reset: {},
    referral: { max: program.referral.maxPaidPer30Days },
    expiry: { days: program.creditExpiryDays, warn: program.expiryWarningDays ?? 7 },
    freeBowl: { days: program.upgradeRewardWindowDays },
    quarterly: { tier: name(program.quarterlyPerk?.tier ?? top.key) },
    earlyAccess: {
      first: name(a.key),
      second: name(b?.key ?? a.key),
      third: name(c?.key ?? top.key),
      firstDays: a.earlyAccessDays,
      secondDays: b?.earlyAccessDays ?? 0,
      thirdDays: c?.earlyAccessDays ?? top.earlyAccessDays,
    },
    queue: {
      second: b?.queueBoost ?? 0,
      secondName: name(b?.key ?? a.key),
      third: c?.queueBoost ?? top.queueBoost,
      thirdName: name(c?.key ?? top.key),
    },
  } as const;
}

export default async function RewardsPage() {
  const locale = await getLocale();
  const [program, badges, challenges] = await Promise.all([getProgram(), getBadges(locale), getChallenges(locale)]);
  const t = await getTranslations("rewards");
  const tierNames = await getTranslations("loyalty.tiers");
  const name = (key: string) => tierNames(`${tierMeta(key).msg}.name`);

  if (!program) {
    return (
      <div data-rewards-page className="mx-auto max-w-3xl px-5 py-24 md:px-8">
        <Display locale={locale} className="m-0 text-oh-cream">
          {t("meta.title")}
        </Display>
        <Body locale={locale} className="m-0 mt-4 text-oh-cream/75">
          {t("unavailable")}
        </Body>
      </div>
    );
  }

  const first = program.tiers[0];
  const top = program.tiers[program.tiers.length - 1];
  const referrer = formatMoney(program.referral.referrerCents, locale);
  const referee = formatMoney(program.referral.refereeCents, locale);

  const seals: GallerySeal[] = badges.map((b) => {
    const copy = localizedCopy(b, locale);
    return { slug: b.slug, iconKey: b.iconKey ?? b.slug, name: copy.name, description: copy.description, category: b.category };
  });

  const faq = faqValues(program, name);
  const faqKeys = Object.keys(faq) as (keyof typeof faq)[];
  const markTones = ["text-oh-cream/60", "text-oh-cream", "text-oh-gold"];

  return (
    <RewardsMemberProvider>
      <div data-rewards-page className="overflow-x-clip">
        {/* Hero */}
        <section aria-labelledby="rewards-title" className="relative isolate overflow-hidden">
          {/* Atmosphere only: the photo sits behind the copy, so it is decorative (alt=""). */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <SitePicture
              image="bowl-slices-top"
              sizes="100vw"
              priority
              alt=""
              className="absolute inset-0 block opacity-50 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-charcoal)_35%,transparent)_0%,color-mix(in_oklab,var(--color-oh-charcoal)_70%,transparent)_45%,var(--color-oh-charcoal)_100%)]" />
          </div>
          <div className="mx-auto flex min-h-[82svh] max-w-6xl flex-col justify-end px-5 pb-12 pt-24 md:min-h-[78svh] md:px-8 md:pb-20">
            <Reveal from="fade">
              <div aria-hidden="true" className="flex items-end gap-4">
                {program.tiers.map((tier, i) => (
                  <span key={tier.key} className={markTones[Math.min(i, markTones.length - 1)]}>
                    <TierMark tier={tierMeta(tier.key).mark} tone="current" size={i === program.tiers.length - 1 ? 56 : 40} />
                  </span>
                ))}
              </div>
              <Eyebrow locale={locale} className="mt-8 text-oh-ember-light">
                {t("hero.eyebrow")}
              </Eyebrow>
              <Display id="rewards-title" locale={locale} className="m-0 mt-3 max-w-3xl text-[clamp(2.75rem,9vw,5.5rem)] text-oh-cream">
                {t("hero.title")}
              </Display>
              <Body locale={locale} className="m-0 mt-5 max-w-xl text-lg text-oh-cream/85">
                {t("hero.lede", { tier: name(top.key) })}
              </Body>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#simulator"
                  data-rewards-cta
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline shadow-[0_10px_30px_-12px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                >
                  {t("hero.cta")}
                  <Icon name="arrow" size={18} />
                </a>
                <Link
                  href={localizedHref(locale, "/order")}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-oh-cream/35 px-6 text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                >
                  {t("hero.order")}
                </Link>
              </div>
              <div className="mt-8 max-w-xl">
                <MemberStatus />
              </div>
            </Reveal>
          </div>
        </section>

        <Section
          id="climb"
          locale={locale}
          eyebrow={t("climb.eyebrow")}
          title={t("climb.title", { first: name(first.key), last: name(top.key) })}
        >
          <div className="max-w-2xl">
            <Climb program={program} />
          </div>
        </Section>

        <Section id="tiers" locale={locale} eyebrow={t("tiers.eyebrow")} title={t("tiers.title")} className="bg-oh-ink/40">
          <TierCards program={program} />
        </Section>

        <Section
          id="simulator"
          locale={locale}
          eyebrow={t("simulator.eyebrow")}
          title={t("simulator.title")}
          lede={t("simulator.lede")}
        >
          <PathSimulator program={program} />
        </Section>

        <Section
          id="credits"
          locale={locale}
          eyebrow={t("credits.eyebrow")}
          title={t("credits.title", { days: program.creditExpiryDays })}
          lede={t("credits.lede")}
          className="bg-oh-ink/40"
        >
          <CreditTimeline program={program} />
        </Section>

        <Section id="referrals" locale={locale} eyebrow={t("referrals.eyebrow")} title={t("referrals.title", { referrer, referee })}>
          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            <Reveal className="min-w-0">
              <Body locale={locale} className="m-0 text-lg text-oh-cream/85">
                {t("referrals.body", { referrer, referee })}
              </Body>
              <Body locale={locale} className="m-0 mt-4 text-oh-cream/70">
                {t("referrals.cap", { max: program.referral.maxPaidPer30Days })}
              </Body>
            </Reveal>
            <div className="min-w-0 rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-5 md:p-7">
              <ReferralPanel program={program} />
            </div>
          </div>
        </Section>

        <Section id="seals" locale={locale} eyebrow={t("seals.eyebrow")} title={t("seals.title")} lede={t("seals.lede")} className="bg-oh-ink/40">
          <SealGallery seals={seals} />
        </Section>

        <Section id="challenges" locale={locale} eyebrow={t("challenges.eyebrow")} title={t("challenges.title")}>
          {challenges.length === 0 ? (
            <Body locale={locale} className="m-0 text-oh-cream/70">
              {t("challenges.empty")}
            </Body>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-3 md:gap-5">
              {challenges.map((c, i) => {
                const copy = localizedCopy(c, locale);
                return (
                  <Reveal as="li" key={c.id} delay={i * 80} className="flex min-w-0 gap-4 rounded-2xl bg-oh-ink p-5 md:flex-col">
                    <Seal iconKey={c.iconKey ?? c.slug} name={copy.name} size={52} variant="outline" className="shrink-0" />
                    <div className="min-w-0">
                      <h3 className="m-0 text-lg font-semibold leading-snug text-oh-cream">{copy.name}</h3>
                      <p className="m-0 mt-1 text-base text-oh-cream/75">{copy.description}</p>
                      <p className="m-0 mt-3 inline-flex rounded-full bg-oh-gold/15 px-3 py-1 text-sm font-semibold text-oh-gold">
                        {t("challenges.reward", { amount: formatMoney(c.rewardCents, locale) })}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          )}
        </Section>

        <Section id="faq" locale={locale} eyebrow={t("faq.eyebrow")} title={t("faq.title")} className="bg-oh-ink/40">
          <div className="max-w-3xl divide-y divide-oh-stone/70 border-y border-oh-stone/70">
            {faqKeys.map((key) => (
              <details key={key} data-faq={key} className="rw-faq group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream">
                  <span className="min-w-0">{t(`faq.items.${key}.q`)}</span>
                  <Icon name="chevron" size={20} className="rw-faq-chevron shrink-0 text-oh-ember-light" />
                </summary>
                <Body locale={locale} className="m-0 pb-5 pr-8 text-oh-cream/80">
                  {t(`faq.items.${key}.a`, faq[key] as Record<string, string | number>)}
                </Body>
              </details>
            ))}
          </div>
        </Section>

        <section aria-label={t("chappy.cta")} className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-6xl">
            <AskChappy />
          </div>
        </section>
      </div>
    </RewardsMemberProvider>
  );
}
