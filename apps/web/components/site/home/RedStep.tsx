/**
 * Task D1, chapter 7: One Red Step. The giving pledge, in the plan's words:
 * 1% of revenue from every company restaurant to ONE RED STEP AT A TIME,
 * the Utah mental health nonprofit.
 *
 * A single red thread sweeps in from the top and runs down the chapter's
 * left gutter beside the copy, drawing itself as you scroll through (a view
 * timeline on stroke-dashoffset, home.css). It never crosses the text.
 * Reduced motion shows it drawn.
 */
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Eyebrow, Title } from "@/components/site/Text";
import "./home.css";

// Same site the footer and the business plan link to.
const FOUNDATION_URL = "https://www.oneredstepatatime.org";

export async function RedStep({ locale }: { locale: string }) {
  const t = await getTranslations("home.redStep");
  const serif = locale.startsWith("zh") ? "font-display-cjk" : "font-display";

  return (
    <section id="red-step" data-chapter="red-step" aria-labelledby="red-step-title" className="hm-thread relative isolate overflow-hidden py-24 pl-11 pr-5 md:px-8 md:py-36">
      <svg
        aria-hidden="true"
        viewBox="0 0 400 1000"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 h-full w-full max-w-[28rem]"
      >
        <path
          d="M410 -4 C 330 40, 150 18, 64 66 C 32 86, 20 112, 20 150 L 20 1004"
          pathLength={1}
          fill="none"
          className="hm-thread-path stroke-oh-ember [stroke-width:2]"
        />
      </svg>
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="red-step-title" locale={locale} className="m-0 mt-3 text-oh-cream [text-wrap:balance]">
            {t("title")}
          </Title>
          <Body locale={locale} className="m-0 mt-5 text-lg text-oh-cream/90">
            {t("body")}
          </Body>
        </Reveal>
        <Reveal className="mt-12 max-w-2xl md:ml-24">
          <p className={`m-0 ${serif} text-[clamp(1.35rem,5.2vw,2rem)] leading-snug text-oh-cream/90`}>{t("vision")}</p>
          <a
            href={FOUNDATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-red-step-link
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oh-ember-light no-underline underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
          >
            {t("link")}
            <span className="sr-only">{` (${t("newTab")})`}</span>
            <Icon name="arrow" size={18} />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
