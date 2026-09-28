/**
 * Task D1, chapter 6: Rewards teaser.
 *
 * The three tier marks stand on pedestals that rise as the chapter scrolls
 * in (a view timeline, home.css .hm-pedestal); each mark rises in after the
 * last (Reveal), and its cashback counts up (CountUp). Every figure comes
 * from the membership program (GET /membership/program, the same source as
 * /rewards); without it the marks and names still show and the numbers
 * don't. Links to /rewards.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { CountUp } from "@/components/site/motion/CountUp";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import { TierMark } from "@/components/site/tiers/TierMark";
import { localizedHref } from "@/lib/site/nav";
import { TIER_META, tierMeta, type PublicProgram } from "@/lib/site/program";
import "./home.css";

const TONES = ["text-oh-cream/70", "text-oh-cream", "text-oh-gold"];
const HEIGHTS = ["h-12", "h-20", "h-28"];
const SIZES = [44, 56, 72];

export async function RewardsTeaser({ locale, program }: { locale: string; program: PublicProgram | null }) {
  const t = await getTranslations("home.rewards");
  const tiers = await getTranslations("loyalty.tiers");
  const rows = program
    ? program.tiers.map((tier) => ({ key: tier.key, pct: tier.cashbackPct as number | null }))
    : Object.keys(TIER_META).map((key) => ({ key, pct: null as number | null }));

  return (
    <section id="rewards" data-chapter="rewards" aria-labelledby="rewards-title" className="bg-oh-ink/50 px-5 py-20 md:px-8 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-end md:gap-16">
        <Reveal className="min-w-0">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="rewards-title" locale={locale} className="m-0 mt-3 max-w-xl text-oh-cream [text-wrap:balance]">
            {t("title")}
          </Title>
          <Body locale={locale} className="m-0 mt-4 max-w-lg text-oh-cream/80">
            {t("lede")}
          </Body>
          <Link
            href={localizedHref(locale, "/rewards")}
            data-home-rewards
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full border border-oh-cream/35 px-6 text-base font-semibold text-oh-cream no-underline transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("cta")}
            <Icon name="arrow" size={18} />
          </Link>
        </Reveal>

        <ol className="m-0 grid min-w-0 list-none grid-cols-3 items-end gap-3 p-0 md:gap-5">
          {rows.map((row, i) => {
            const meta = tierMeta(row.key);
            const k = Math.min(i, 2);
            return (
              <li key={row.key} data-tier={row.key} className="flex min-w-0 flex-col items-center text-center">
                <Reveal delay={i * 140} className={`flex flex-col items-center ${TONES[k]}`}>
                  <TierMark tier={meta.mark} tone="current" size={SIZES[k]} />
                  <span className="mt-3 block text-sm font-semibold leading-tight text-oh-cream">{tiers(`${meta.msg}.name`)}</span>
                  {row.pct !== null ? (
                    <span className="mt-1 block leading-tight">
                      <CountUp to={row.pct} suffix="%" duration={1100} className="font-display text-3xl text-oh-cream md:text-4xl" />
                      <span className="block text-xs text-oh-cream/70">{t("cashback")}</span>
                    </span>
                  ) : null}
                </Reveal>
                <span
                  aria-hidden="true"
                  className={`hm-pedestal mt-4 block w-full rounded-t-lg border-t-2 border-oh-gold/70 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-oh-gold)_22%,transparent),transparent)] ${HEIGHTS[k]}`}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
