/**
 * /referral (Task D9): give $5, get $5. The amounts, the 30-day cap and the
 * credit expiry come from GET /membership/program (read here on the server);
 * the member's link, earnings (REFERRAL CreditLots) and cap count come from
 * GET /users/:id/credits in ReferralDashboard. Signed-out visitors see the
 * whole pitch and a sign-in panel where the link would be.
 *
 * Referral rewards are Oh! store credit. Nothing on this page may suggest
 * cash or a card refund.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { SitePicture } from "@/components/site/picture/SitePicture";
import { SITE_IMAGES } from "@/lib/site/images";
import { formatMoney, getReferralProgram } from "@/lib/site/program";
import ReferralDashboard from "./referral-dashboard";

export const dynamic = "force-dynamic";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("referralPage.meta");
  return { title: t("title"), description: t("description") };
}

export default async function ReferralPage() {
  const locale = await getLocale();
  const t = await getTranslations("referralPage");
  const tRoot = await getTranslations();
  const program = await getReferralProgram();
  const friend = formatMoney(program.refereeCents, locale);
  const you = formatMoney(program.referrerCents, locale);
  const cjk = locale.startsWith("zh");

  const steps = [
    { n: 1, title: t("step1Title"), body: t("step1Body"), icon: "share" as const },
    { n: 2, title: t("step2Title", { friend }), body: t("step2Body"), icon: "user" as const },
    { n: 3, title: t("step3Title", { you }), body: t("step3Body", { you }), icon: "bowl" as const },
  ];

  return (
    <div data-referral-page className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:pt-14">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-start md:gap-12">
        <header className="flex flex-col gap-4 md:sticky md:top-24">
          <Eyebrow locale={locale} className="text-oh-gold">
            {t("eyebrow")}
          </Eyebrow>
          <Display locale={locale} className="m-0 text-oh-cream [overflow-wrap:anywhere]">
            {t("title", { friend, you })}
          </Display>
          <Body locale={locale} className="m-0 max-w-xl text-oh-cream/80">
            {t("lede", { friend, you })}
          </Body>

          {/* Two stubs: what the friend gets, what you get. */}
          <div aria-hidden="true" className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
            <Stub amount={friend} label={t("step2Title", { friend })} cjk={cjk} tone="linen" />
            <Stub amount={you} label={t("step3Title", { you })} cjk={cjk} tone="ember" />
          </div>
        </header>

        <ReferralDashboard program={program} />
      </div>

      <Reveal as="section" aria-labelledby="referral-steps" className="mt-14 md:mt-20">
        <Title locale={locale} id="referral-steps" className="m-0 text-oh-cream">
          {t("stepsTitle")}
        </Title>
        <ol className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-5">
          {steps.map((s) => (
            <li key={s.n} data-referral-step={s.n} className="flex gap-4 rounded-3xl bg-oh-ink p-5 md:flex-col">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-stone text-oh-gold">
                <Icon name={s.icon} size={22} />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className={`text-lg font-semibold text-oh-cream [overflow-wrap:anywhere] ${cjk ? "font-cjk" : "font-body"}`}>{s.title}</span>
                <span className="text-[15px] leading-relaxed text-oh-mute">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mt-10 grid gap-5 md:mt-14 md:grid-cols-2">
        <Reveal as="section" aria-labelledby="referral-rules" className="rounded-3xl border border-oh-stone p-5 md:p-6">
          <h2 id="referral-rules" className={`m-0 text-lg font-semibold text-oh-cream ${cjk ? "font-cjk" : "font-body"}`}>
            {t("rulesTitle")}
          </h2>
          <ul data-referral-rules className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
            {[t("ruleStoreCredit"), t("ruleExpiry", { days: program.creditExpiryDays }), t("ruleCap", { max: program.maxPaidPer30Days }), t("ruleNew")].map((rule) => (
              <li key={rule} className="flex gap-3 text-[15px] leading-relaxed text-oh-cream/85">
                <Icon name="check" size={18} className="mt-0.5 shrink-0 text-oh-olive-light" />
                <span className="min-w-0">{rule}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="section" aria-labelledby="referral-more" delay={80} className="relative overflow-hidden rounded-3xl bg-oh-ink">
          <span className="relative block aspect-[16/7] w-full bg-oh-linen [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
            <SitePicture image="bowl-flatlay" sizes="(min-width: 768px) 560px, 100vw" alt={tRoot(SITE_IMAGES["bowl-flatlay"].alt)} className="block h-full w-full" />
          </span>
          <div className="flex flex-col items-start gap-3 p-5 md:p-6">
            <h2 id="referral-more" className={`m-0 text-lg font-semibold text-oh-cream ${cjk ? "font-cjk" : "font-body"}`}>
              {t("more")}
            </h2>
            <p className="m-0 text-[15px] text-oh-mute">{t("moreBody")}</p>
            <Link href={`/${locale}/challenges`} data-referral-more className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-oh-stone px-5 text-[15px] font-semibold text-oh-cream no-underline ${FOCUS}`}>
              {t("moreCta")}
              <Icon name="chevron" size={18} />
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function Stub({ amount, label, cjk, tone }: { amount: string; label: string; cjk: boolean; tone: "linen" | "ember" }) {
  const skin = tone === "linen" ? "bg-oh-linen text-oh-charcoal" : "bg-oh-ember-deep text-oh-cream";
  return (
    <span className={`relative flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl p-4 ${skin}`}>
      {/* The perforated edge of a ticket stub. */}
      <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-oh-charcoal" />
      <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-oh-charcoal" />
      <span className={`text-4xl leading-none ${cjk ? "font-display-cjk" : "font-display"}`}>{amount}</span>
      <span className="mt-3 text-sm font-medium leading-snug [overflow-wrap:anywhere]">{label}</span>
    </span>
  );
}
