/**
 * Task D2: the FAQ that doubles as the how-it-works page. Native
 * <details>/<summary>, so it opens from the keyboard (Enter or Space) and
 * works before hydration. The height transition is CSS only
 * (experience.css, `::details-content` with `interpolate-size`), and
 * browsers without it simply open instantly.
 */
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Eyebrow, Title } from "@/components/site/Text";

export const FAQ_KEYS = ["order", "together", "server", "more", "phone", "tip", "bowl", "members"] as const;

export async function Faq({ locale }: { locale: string }) {
  const t = await getTranslations("experience.faq");
  return (
    <section id="faq" aria-labelledby="faq-title" className="xp-snap border-t border-oh-stone/60 bg-oh-ink/40 px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <Reveal>
          <Eyebrow locale={locale} className="text-oh-ember-light">
            {t("eyebrow")}
          </Eyebrow>
          <Title id="faq-title" locale={locale} className="m-0 mt-3 text-oh-cream">
            {t("title")}
          </Title>
        </Reveal>
        <div className="mt-8 divide-y divide-oh-stone/70 border-y border-oh-stone/70 lg:mt-0">
          {FAQ_KEYS.map((key) => (
            <details key={key} data-faq={key} className="xp-faq group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream">
                <span className="min-w-0">{t(`items.${key}.q`)}</span>
                <Icon name="chevron" size={20} className="xp-chevron shrink-0 text-oh-ember-light" />
              </summary>
              <Body locale={locale} className="m-0 pb-5 pr-8 text-oh-cream/80">
                {t(`items.${key}.a`)}
              </Body>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
