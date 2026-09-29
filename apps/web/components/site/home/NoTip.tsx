/**
 * Task D1, chapter 5: Your visit, your way. Typographic, no photo.
 *
 * Order your way, seat yourself, help one tap away, no tipping (the welcoming
 * voice of 2026-09-29, which replaced "No host. No server. No check. No tip.").
 *
 * Four short lines at display size. Each one lights from ash to cream as
 * it crosses the viewport (a view timeline per line drives --hm-lit, see
 * home.css), the last in ember; an ember rule draws under them, and the
 * reason follows. Where view timelines aren't supported, or with reduced
 * motion, every line is simply lit.
 */
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Eyebrow } from "@/components/site/Text";
import "./home.css";

const WORDS = ["order", "seat", "help", "tip"] as const;

export async function NoTip({ locale }: { locale: string }) {
  const t = await getTranslations("home.noTip");
  const serif = locale.startsWith("zh") ? "font-display-cjk" : "font-display";

  return (
    <section id="no-tip" data-chapter="no-tip" aria-labelledby="no-tip-title" className="px-5 py-24 md:px-8 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        <h2
          id="no-tip-title"
          className={`m-0 mt-6 ${serif} text-[clamp(2.9rem,13vw,8.5rem)] font-normal leading-[0.98] tracking-[-0.01em] [overflow-wrap:anywhere]`}
        >
          {WORDS.map((w, i) => (
            <span
              key={w}
              className={`hm-word block ${i === WORDS.length - 1 ? "[--hm-word-on:var(--color-oh-ember-light)]" : ""}`}
            >
              {t(`words.${w}`)}
            </span>
          ))}
        </h2>
        <div aria-hidden="true" className="hm-rule mt-10 h-px w-full max-w-md bg-oh-ember" />
        <Reveal className="mt-8 max-w-xl">
          <Body locale={locale} className="m-0 text-lg text-oh-cream/90 md:text-xl">
            {t("body")}
          </Body>
          <Body locale={locale} className="m-0 mt-4 text-oh-cream/70">
            {t("note")}
          </Body>
          {/* The bridge into the One Red Step chapter, which follows directly (2026-09-28). */}
          <Body locale={locale} data-no-tip-give-back className="m-0 mt-6 text-lg font-semibold text-oh-ember-light md:text-xl">
            {t("giveBack")}
          </Body>
        </Reveal>
      </div>
    </section>
  );
}
