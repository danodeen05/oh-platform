/**
 * Task D2: the experience page. The business plan's visit in six steps
 * (arrive, order, walk, settle, taste, leave), each one screen tall, with
 * the journey pinned on City Creek's real comb floor plan, then the FAQ
 * that doubles as how it works, and the close (Order, Ask Chappy).
 *
 * Every factual line is adapted from the plan's own copy (`plan.experience.*`,
 * `plan.floorPlan.*`, `plan.operations.program.*`) or copy already vetted on
 * the home page; see the D2 report for the key behind each line.
 *
 * Server-rendered. Client islands: the journey map, the Reveal wrappers and
 * the Ask Chappy button. No API calls: nothing here depends on live data.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AskChappyButton } from "@/components/site/experience/AskChappy";
import { Faq } from "@/components/site/experience/Faq";
import { Steps } from "@/components/site/experience/Steps";
import "@/components/site/experience/experience.css";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { EXPERIENCE_STEPS } from "@/lib/site/experience";
import { localizedHref } from "@/lib/site/nav";

// 64px at up to 3x: the site copy of the avatar in /brand/ (the plan's /plan/ folder is private).
const CHAPPY_AVATAR_LARGE = "/brand/chappy-192.webp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("experience.meta");
  return { title: t("title"), description: t("description") };
}

const PRIMARY =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-7 text-base font-semibold text-oh-cream no-underline shadow-[0_12px_32px_-14px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const QUIET =
  "inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-cream/90 no-underline underline-offset-4 hover:text-oh-cream hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export default async function ExperiencePage() {
  const locale = await getLocale();
  const t = await getTranslations("experience");

  return (
    <div data-experience-page className="overflow-x-clip bg-oh-charcoal">
      {/* Intro: what this is, the six steps as an index, and the order CTA. */}
      <section aria-labelledby="xp-title" className="xp-snap xp-intro flex flex-col justify-center px-5 py-10 md:px-8 lg:min-h-[70svh] lg:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("intro.eyebrow")}
            </Eyebrow>
            <Display id="xp-title" locale={locale} className="m-0 mt-3 max-w-[16ch] text-[clamp(2.6rem,11vw,5.5rem)]! leading-[1.02]! text-oh-cream [text-wrap:balance]">
              {t("intro.title")}
            </Display>
            <Body locale={locale} className="m-0 mt-4 max-w-2xl text-oh-cream/85 md:text-lg">
              {t("intro.lede")}
            </Body>
          </Reveal>

          <nav aria-label={t("stepper.label")} className="mt-8">
            <ol className="m-0 grid list-none grid-cols-2 gap-x-4 p-0 sm:grid-cols-3 lg:grid-cols-6">
              {EXPERIENCE_STEPS.map((key, i) => (
                <li key={key} className="border-t border-oh-stone/70">
                  <a
                    href={`#step-${key}`}
                    aria-label={t("stepper.go", { n: i + 1, name: t(`steps.${key}.eyebrow`) })}
                    className="flex min-h-12 items-baseline gap-2.5 py-2.5 text-oh-cream no-underline hover:text-oh-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                  >
                    <span aria-hidden="true" className="font-display text-xl leading-none text-oh-gold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-base font-semibold">{t(`steps.${key}.eyebrow`)}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={localizedHref(locale, "/order")} data-experience-order className={PRIMARY}>
              {t("close.order")}
              <Icon name="arrow" size={18} />
            </Link>
            <a href="#step-arrive" className={QUIET}>
              {t("intro.start")}
              <Icon name="arrow" size={18} className="rotate-90" />
            </a>
          </div>
        </div>
      </section>

      <Steps locale={locale} />

      <Faq locale={locale} />

      {/* Close: the order CTA, locations, and Chappy for anything the FAQ didn't answer. */}
      <section aria-labelledby="xp-close-title" className="xp-snap px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal className="flex flex-col items-start">
            <Title id="xp-close-title" locale={locale} className="m-0 text-[clamp(2rem,7vw,3.5rem)]! text-oh-cream">
              {t("close.title")}
            </Title>
            <Body locale={locale} className="m-0 mt-3 max-w-xl text-oh-cream/85 md:text-lg">
              {t("close.body")}
            </Body>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={localizedHref(locale, "/order")} data-experience-order className={PRIMARY}>
                {t("close.order")}
                <Icon name="arrow" size={18} />
              </Link>
              <Link href={localizedHref(locale, "/locations")} className={QUIET}>
                <Icon name="pin" size={20} />
                {t("close.locations")}
              </Link>
            </div>
          </Reveal>

          <div className="mt-12 flex flex-col items-start gap-5 rounded-[2rem] border border-oh-stone/70 bg-oh-ink p-6 sm:flex-row sm:items-center md:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- G2a: a pre-sized static file, no next/image on (site) pages */}
            <img src={CHAPPY_AVATAR_LARGE} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-2xl font-semibold leading-tight text-oh-cream">{t("close.chappyTitle")}</h2>
              <p className="m-0 mt-1 text-base text-oh-cream/75">{t("close.chappyBody")}</p>
            </div>
            <AskChappyButton label={t("close.chappyCta")} prompt={t("close.chappyPrompt")} />
          </div>
        </div>
      </section>
    </div>
  );
}
