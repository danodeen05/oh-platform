/**
 * /challenges (Task D9): the two standing ways to earn (a meal for a
 * stranger, and referrals), then the open challenges from the database,
 * with the names and descriptions the API localizes (F1a: Challenge.i18n,
 * GET /challenges?locale=). A server component.
 *
 * Rewards are Oh! store credit, never cash.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { API_URL } from "@/lib/api";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Seal } from "@/components/site/seal/Seal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { SITE_IMAGES } from "@/lib/site/images";
import { formatMoney, getReferralProgram } from "@/lib/site/program";

export const dynamic = "force-dynamic";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

type ApiChallenge = { id: string; slug: string; name: string; description: string; rewardCents: number; iconKey?: string | null; endsAt?: string | null };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("challengesPage.meta");
  return { title: t("title"), description: t("description") };
}

async function getChallenges(locale: string): Promise<ApiChallenge[] | null> {
  try {
    const res = await fetch(`${API_URL}/challenges?locale=${encodeURIComponent(locale)}`, { cache: "no-store", headers: { "x-tenant-slug": "oh" } });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

export default async function ChallengesPage() {
  const locale = await getLocale();
  const t = await getTranslations("challengesPage");
  const tRoot = await getTranslations();
  const [rows, program] = await Promise.all([getChallenges(locale), getReferralProgram()]);
  // The meal gift has its own page (featured above), so it isn't listed twice.
  const challenges = rows?.filter((c) => c.slug !== "meal-for-stranger") ?? null;
  const friend = formatMoney(program.refereeCents, locale);
  const you = formatMoney(program.referrerCents, locale);
  const cjk = locale.startsWith("zh");

  return (
    <div data-challenges-page className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:pt-14">
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

      <div className="mt-8 grid gap-5 md:mt-12 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-6">
        {/* Meal for a Stranger */}
        <Link href={`/${locale}/challenges/meal-for-stranger`} data-challenges-give className={`group relative flex flex-col overflow-hidden rounded-[28px] bg-oh-ink text-oh-cream no-underline ${FOCUS}`}>
          <span className="relative block aspect-[4/3] w-full overflow-hidden bg-oh-linen md:aspect-[16/10] [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-[1.03] motion-reduce:[&_img]:transition-none">
            <SitePicture image="bowl-slices-top" sizes="(min-width: 768px) 640px, 100vw" priority alt={tRoot(SITE_IMAGES["bowl-slices-top"].alt)} className="block h-full w-full" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-oh-ink via-oh-ink/10 to-transparent" />
          </span>
          <span className="flex flex-1 flex-col gap-2 p-5 pt-2 md:p-6 md:pt-3">
            <span className={`text-xs font-medium uppercase tracking-[0.2em] text-oh-gold ${cjk ? "font-cjk" : "font-body"}`}>{t("giveEyebrow")}</span>
            <span className={`text-[1.75rem] leading-tight [overflow-wrap:anywhere] ${cjk ? "font-display-cjk" : "font-display"}`}>{t("giveTitle")}</span>
            <span className="text-[15px] leading-relaxed text-oh-cream/80">{t("giveBody")}</span>
            <span className="mt-3 inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-oh-ember-deep pl-5 pr-4 text-base font-semibold text-oh-cream transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none">
              <Icon name="gift" size={20} />
              {t("giveCta")}
              <Icon name="chevron" size={18} />
            </span>
          </span>
        </Link>

        {/* Referrals */}
        <Link href={`/${locale}/referral`} data-challenges-refer className={`group flex flex-col justify-between gap-6 rounded-[28px] bg-oh-linen p-5 text-oh-charcoal no-underline md:p-6 ${FOCUS}`}>
          <span className="flex flex-col gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-oh-charcoal text-oh-cream">
              <Icon name="share" size={22} />
            </span>
            <span className={`text-[1.75rem] leading-tight [overflow-wrap:anywhere] ${cjk ? "font-display-cjk" : "font-display"}`}>{t("referTitle", { friend, you })}</span>
            <span className="text-[15px] leading-relaxed text-oh-charcoal/80">{t("referBody", { friend, you })}</span>
          </span>
          <span className="inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-oh-charcoal pl-5 pr-4 text-base font-semibold text-oh-cream">
            {t("referCta")}
            <Icon name="chevron" size={18} />
          </span>
        </Link>
      </div>

      <Reveal as="section" aria-labelledby="challenges-list" className="mt-14 md:mt-20">
        <Title locale={locale} id="challenges-list" className="m-0 text-oh-cream">
          {t("listTitle")}
        </Title>
        {challenges === null ? (
          <div role="alert" data-challenges-error className="mt-6 rounded-3xl bg-oh-ink p-6">
            <p className="m-0 text-lg font-semibold text-oh-cream">{t("error")}</p>
            <a href={`/${locale}/challenges`} className={`mt-4 inline-flex min-h-11 items-center rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline ${FOCUS}`}>
              {t("retry")}
            </a>
          </div>
        ) : challenges.length === 0 ? (
          <p data-challenges-empty className="m-0 mt-6 rounded-3xl border border-oh-stone p-6 text-[15px] text-oh-mute">
            {t("empty")}
          </p>
        ) : (
          <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-5">
            {challenges.map((c) => (
              <li key={c.id} data-challenge={c.slug} className="flex gap-4 rounded-3xl bg-oh-ink p-5 md:flex-col">
                <Seal iconKey={c.iconKey || c.slug} name={c.name} size={56} earned={false} className="shrink-0" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={`text-lg font-semibold text-oh-cream [overflow-wrap:anywhere] ${cjk ? "font-cjk" : "font-body"}`}>{c.name}</span>
                  <span className="text-[15px] leading-relaxed text-oh-mute">{c.description}</span>
                  {c.rewardCents > 0 ? (
                    <span data-challenge-reward className="mt-2 inline-flex items-center gap-2 self-start rounded-full bg-oh-stone px-3 py-1 text-sm font-semibold text-oh-gold">
                      {t("reward", { amount: formatMoney(c.rewardCents, locale) })}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-5 text-sm text-oh-mute">{t("creditNote")}</p>
      </Reveal>
    </div>
  );
}
