/**
 * Task D11: the shared frame for the fine-print pages (privacy,
 * accessibility, SMS consent). A server component: a quiet hero, an
 * "on this page" index (a sticky column at desktop width, a disclosure on
 * a phone), the sections, a contact card and links to the other legal
 * pages. Reading width is capped for long text.
 *
 * Copy comes in already translated; addresses, URLs and keywords that stay
 * the same in every language are wrapped in <Literal> (data-literal), which
 * the D11 e2e treats as data, not copy.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { localizedHref } from "@/lib/site/nav";

export interface LegalSection {
  id: string;
  title: string;
  children: ReactNode;
}

export type LegalSlug = "privacy" | "accessibility" | "sms-consent";

const RELATED: { slug: LegalSlug; key: "privacy" | "accessibility" | "smsConsent" }[] = [
  { slug: "privacy", key: "privacy" },
  { slug: "accessibility", key: "accessibility" },
  { slug: "sms-consent", key: "smsConsent" },
];

/** A value that reads the same in every language (an address, a URL, a keyword). translate="no" keeps browser translators and the English-leak crawl (Task F1) off it. */
export function Literal({ children, as = "span", className }: { children: ReactNode; as?: "span" | "code" | "strong"; className?: string }) {
  const Tag = as;
  return (
    <Tag data-literal translate="no" className={className}>
      {children}
    </Tag>
  );
}

/** A mailto link whose address is a literal. */
export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="break-all font-semibold text-oh-ember-light underline decoration-oh-ember-light/40 underline-offset-4 hover:decoration-oh-ember-light">
      <Literal>{email}</Literal>
    </a>
  );
}

/** Body list with the site's brush-dot bullets. */
export function LegalList({ items, locale }: { items: ReactNode[]; locale: string }) {
  return (
    <ul className="m-0 mt-4 grid list-none gap-3 p-0">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-oh-ember-light" />
          <Body as="span" locale={locale} className="m-0 min-w-0 text-oh-cream/85">
            {item}
          </Body>
        </li>
      ))}
    </ul>
  );
}

export function LegalParagraph({ children, locale, className = "" }: { children: ReactNode; locale: string; className?: string }) {
  return (
    <Body locale={locale} className={`m-0 mt-4 text-oh-cream/85 first:mt-0 ${className}`}>
      {children}
    </Body>
  );
}

export async function LegalPage({
  slug,
  locale,
  title,
  lede,
  updated,
  sections,
}: {
  slug: LegalSlug;
  locale: string;
  title: string;
  lede: string;
  updated?: string;
  sections: LegalSection[];
}) {
  const t = await getTranslations("legal");
  const cjk = locale.startsWith("zh");
  const index = (
    <ol className="m-0 grid list-none gap-1 p-0">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-base text-oh-cream/75 no-underline transition-colors hover:bg-oh-cream/5 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream"
          >
            <span aria-hidden="true" className="w-5 shrink-0 text-right text-sm tabular-nums text-oh-mute">
              {i + 1}
            </span>
            <span className="min-w-0">{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div data-legal-page={slug} className="overflow-x-clip">
      <section aria-labelledby="legal-title" className="border-b border-oh-stone/70 px-5 pb-12 pt-16 md:px-8 md:pb-16 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <Reveal from="fade">
            <Eyebrow locale={locale} className="text-oh-ember-light">
              {t("eyebrow")}
            </Eyebrow>
            <Display id="legal-title" locale={locale} className="m-0 mt-3 max-w-3xl text-oh-cream">
              {title}
            </Display>
            <Body locale={locale} className="m-0 mt-5 max-w-2xl text-lg text-oh-cream/80">
              {lede}
            </Body>
            {updated ? (
              <p className="m-0 mt-5 inline-flex items-center gap-2 text-sm text-oh-mute">
                <Icon name="clock" size={16} />
                {updated}
              </p>
            ) : null}
          </Reveal>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-16 md:px-8 md:py-16">
        {/* Index: a disclosure on a phone, a sticky column on a wide screen. */}
        <nav aria-label={t("onThisPage")} className="min-w-0">
          <details className="group rounded-2xl border border-oh-stone/70 bg-oh-ink md:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-semibold text-oh-cream focus-visible:outline-2 focus-visible:outline-oh-cream">
              <span>{t("jump")}</span>
              <Icon name="chevron" size={18} className="shrink-0 text-oh-ember-light rotate-90 transition-transform group-open:-rotate-90" />
            </summary>
            <div className="px-2 pb-3">{index}</div>
          </details>
          <div className="sticky top-24 hidden md:block">
            <p className="m-0 mb-3 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("onThisPage")}</p>
            {index}
          </div>
        </nav>

        <div className="min-w-0 max-w-[68ch]">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24 border-t border-oh-stone/50 py-9 first:border-t-0 first:pt-0">
              <Reveal>
                <h2 id={`${s.id}-h`} className={`m-0 flex items-baseline gap-3 text-[1.35rem] font-normal leading-snug text-oh-cream md:text-[1.6rem] ${cjk ? "font-display-cjk" : "font-display"}`}>
                  <span aria-hidden="true" className="text-base tabular-nums text-oh-ember-light">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">{s.title}</span>
                </h2>
                <div className="mt-4">{s.children}</div>
              </Reveal>
            </section>
          ))}

          <Reveal className="mt-6 flex flex-col items-start gap-4 rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-6 sm:flex-row sm:items-center md:p-7">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep/30 text-oh-ember-light">
              <Icon name="mail" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-lg font-semibold text-oh-cream">{t("questions.title")}</p>
              <p className="m-0 mt-1 text-base text-oh-cream/75">{t("questions.body")}</p>
            </div>
            <Link
              href={localizedHref(locale, "/contact")}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            >
              {t("questions.cta")}
              <Icon name="arrow" size={18} />
            </Link>
          </Reveal>

          <nav aria-label={t("related")} className="mt-10">
            <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("related")}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {RELATED.filter((r) => r.slug !== slug).map((r) => (
                <li key={r.slug}>
                  <Link
                    href={localizedHref(locale, `/${r.slug}`)}
                    className="inline-flex min-h-11 items-center rounded-full border border-oh-stone px-4 text-base text-oh-cream/85 no-underline transition-colors hover:border-oh-cream/60 hover:text-oh-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
                  >
                    {t(`nav.${r.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
