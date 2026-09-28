/**
 * /giving, section 1: the hero. The home chapter's red thread (the same
 * `.hm-thread` view timeline and `.hm-thread-path` stroke-dashoffset draw,
 * home.css) sweeps in from the top and runs down the left gutter beside the
 * copy, drawing itself as the hero scrolls through. It never crosses the
 * text. Without view timelines, or with reduced motion, it is simply drawn.
 */
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/site/motion/Reveal";
import { Display, Eyebrow } from "@/components/site/Text";
import { FOUNDATION_MARK } from "@/lib/site/foundation";
import "@/components/site/home/home.css";

export async function GivingHero({ locale }: { locale: string }) {
  const t = await getTranslations("giving.hero");
  const serif = locale.startsWith("zh") ? "font-display-cjk" : "font-display";

  return (
    <section
      data-giving-section="hero"
      aria-labelledby="giving-title"
      className="hm-thread relative isolate overflow-hidden pb-16 pl-11 pr-5 pt-10 md:px-8 md:pb-28 md:pt-20"
    >
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
        <Reveal className="max-w-3xl md:ml-24">
          {/* eslint-disable-next-line @next/next/no-img-element -- G2a: a pre-sized static file, no next/image on (site) pages */}
          <img src={FOUNDATION_MARK} alt="" width={48} height={48} decoding="async" className="mb-6 h-12 w-12 object-contain" />
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Display id="giving-title" locale={locale} className="m-0 mt-3 max-w-[14ch] text-[clamp(2.6rem,11vw,5.5rem)]! leading-[1.02]! text-oh-cream [text-wrap:balance]">
            {t("title")}
          </Display>
        </Reveal>
        <Reveal className="mt-12 max-w-2xl md:ml-24 md:mt-16">
          <Eyebrow locale={locale} className="text-oh-mute">
            {t("visionLabel")}
          </Eyebrow>
          <p className={`m-0 mt-3 ${serif} text-[clamp(1.35rem,5.2vw,2rem)] leading-snug text-oh-cream/90`}>{t("vision")}</p>
        </Reveal>
      </div>
    </section>
  );
}
