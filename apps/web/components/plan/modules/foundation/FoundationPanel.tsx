import { getTranslations } from "next-intl/server";
import { fmtCompact, fmtCurrency, fmtInteger, fmtPercent, type ScenarioKey } from "@oh/plan-model";
import { FOUNDATION, displayUrl } from "./contact";
import { givingFigures } from "./giving";

interface Props {
  locale: string;
  scenario?: ScenarioKey;
  /** Dark for the interactive plan, light for the print route (links become plain URLs). */
  tone?: "dark" | "light";
}

const TONE = {
  dark: { box: "border-oh-stone bg-oh-ink", eyebrow: "text-oh-ember-light", title: "text-oh-cream", body: "text-oh-mute", strong: "text-oh-cream", rule: "border-oh-stone", figure: "text-oh-ember", card: "border-oh-stone bg-oh-charcoal", link: "text-oh-cream underline decoration-oh-stone underline-offset-4 hover:text-oh-ember-light" },
  light: { box: "border-oh-charcoal/15 bg-transparent", eyebrow: "text-oh-ember-deep", title: "text-oh-charcoal", body: "text-oh-stone", strong: "text-oh-charcoal", rule: "border-oh-charcoal/15", figure: "text-oh-ember-deep", card: "border-oh-charcoal/15 bg-transparent", link: "text-oh-charcoal" },
} as const;

/**
 * ONE RED STEP AT A TIME®, the mental health foundation Oh! gives 1% of
 * revenue to (owner decision 2026-09-27). The pledge figures come from the
 * engine for the reader's scenario; the identity and contact details are the
 * foundation's own, from contact.ts. Async server component so the Experience
 * page and the print route share it.
 */
export async function FoundationPanel({ locale, scenario = "base", tone = "dark" }: Props) {
  const t = await getTranslations("plan.foundation");
  const c = TONE[tone];
  const print = tone === "light";
  const g = givingFigures(scenario);
  const values = {
    pct: fmtPercent(g.pct, locale, 0),
    perUnit: fmtCurrency(g.perUnit, { locale }),
    fiveYear: fmtCompact(g.fiveYear, { locale }),
    units: fmtInteger(g.units, locale),
    ein: FOUNDATION.ein,
  };
  const link = (href: string, label: string) =>
    print ? (
      <span className={c.link}>{displayUrl(href)}</span>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={c.link}>
        {label}
      </a>
    );

  return (
    <section data-plan-foundation="" aria-labelledby="plan-foundation-title" className={["rounded-lg border p-5 md:p-8", c.box].join(" ")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FOUNDATION.logo.src} alt={FOUNDATION.logo.alt} width={FOUNDATION.logo.width} height={FOUNDATION.logo.height} className="h-20 w-20 shrink-0 rounded-md bg-white object-contain p-1.5" />
        <div className="min-w-0">
          <p className={["m-0 text-[0.72rem] uppercase tracking-[0.16em]", c.eyebrow].join(" ")}>{t("eyebrow")}</p>
          <h2 id="plan-foundation-title" className={["m-0 mt-1 font-display text-[clamp(1.5rem,3vw,2.1rem)] leading-tight", c.title].join(" ")}>
            {FOUNDATION.name}
          </h2>
          <p className={["m-0 mt-1 text-[0.82rem]", c.body].join(" ")}>{t("identity", values)}</p>
        </div>
      </div>

      <blockquote className={["m-0 mt-6 border-l-2 border-oh-ember pl-4 font-display text-[1.1rem] leading-snug", c.strong].join(" ")}>
        {t("mission")}
        <footer className={["mt-2 font-sans text-[0.72rem] uppercase tracking-[0.14em]", c.body].join(" ")}>{t("missionSource")}</footer>
      </blockquote>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className={["rounded-md border p-4", c.card].join(" ")}>
          <p className={["m-0 font-display text-[2rem] leading-none tabular-nums", c.figure].join(" ")}>{values.pct}</p>
          <p className={["m-0 mt-2 text-[0.8rem] leading-snug", c.body].join(" ")}>{t("pledge.pct")}</p>
        </div>
        <div className={["rounded-md border p-4", c.card].join(" ")}>
          <p className={["m-0 font-display text-[2rem] leading-none tabular-nums", c.strong].join(" ")}>{values.perUnit}</p>
          <p className={["m-0 mt-2 text-[0.8rem] leading-snug", c.body].join(" ")}>{t("pledge.perUnit")}</p>
        </div>
        <div className={["rounded-md border p-4", c.card].join(" ")}>
          <p className={["m-0 font-display text-[2rem] leading-none tabular-nums", c.strong].join(" ")}>{values.fiveYear}</p>
          <p className={["m-0 mt-2 text-[0.8rem] leading-snug", c.body].join(" ")}>{t("pledge.fiveYear", values)}</p>
        </div>
      </div>
      <p className={["m-0 mt-3 max-w-3xl text-[0.82rem] leading-relaxed", c.body].join(" ")}>{t("pledge.note")}</p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className={["m-0 font-display text-[1.2rem]", c.title].join(" ")}>{t("guests.title")}</h3>
          <ul className={["m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[0.9rem] leading-relaxed", c.body].join(" ")}>
            {(["status", "home", "footer"] as const).map((k) => (
              <li key={k} className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-oh-ember" />
                <span>{t(`guests.items.${k}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={["m-0 font-display text-[1.2rem]", c.title].join(" ")}>{t("fit.title")}</h3>
          <p className={["m-0 mt-3 text-[0.9rem] leading-relaxed", c.body].join(" ")}>{t("fit.body")}</p>
        </div>
      </div>

      <div className={["mt-8 border-t pt-6", c.rule].join(" ")}>
        <h3 className={["m-0 font-display text-[1.2rem]", c.title].join(" ")}>{t("contact.title")}</h3>
        <dl className="m-0 mt-3 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.88rem]">
          <dt className={c.body}>{t("contact.website")}</dt>
          <dd className="m-0 break-words">{link(FOUNDATION.website, displayUrl(FOUNDATION.website))}</dd>
          <dt className={c.body}>{t("contact.donate")}</dt>
          <dd className="m-0 break-words">{link(FOUNDATION.donate, t("contact.donateCta"))}</dd>
          <dt className={c.body}>{t("contact.store")}</dt>
          <dd className="m-0 break-words">{link(FOUNDATION.store, t("contact.storeCta"))}</dd>
          <dt className={c.body}>{t("contact.mail")}</dt>
          <dd className={["m-0", c.strong].join(" ")}>
            {FOUNDATION.mail[0]}
            <br />
            {FOUNDATION.mail[1]}
          </dd>
          <dt className={c.body}>{t("contact.social")}</dt>
          <dd className="m-0">
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
              {FOUNDATION.social.map((s) => (
                <li key={s.key}>
                  {print ? (
                    <span className={c.link}>
                      {s.label} {s.handle}
                    </span>
                  ) : (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={c.link} aria-label={`${FOUNDATION.name} ${s.label}`}>
                      {s.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </div>
    </section>
  );
}
