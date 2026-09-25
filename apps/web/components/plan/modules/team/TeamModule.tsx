import { getLocale, getTranslations } from "next-intl/server";
import { BASE, FRANCHISE_MARKETS, FRANCHISE_TERMS, OPENING_SCHEDULE, PARTNERSHIP_TERMS, computeOwnership, fmtCompact, fmtPercent } from "@oh/plan-model";
import { PhotoPlaceholder } from "@/components/plan/primitives/PhotoPlaceholder";

const ENTITY = {
  name: "Oh! Beef Noodle Soup, LLC",
  utahEntity: "14642519-0160",
  filed: "2025-12-22",
  effective: "2026-01-01",
  office: "379 W 3175 N, Lehi, UT 84043",
};

/**
 * Team and Governance (spec 6.9): the founder, the financial partner seat
 * with its derived stake, the entity, the advisory gaps we are filling and
 * the hiring plan with the Director of Operations flagged before unit three.
 * Server component: nothing here moves.
 */
export async function TeamModule() {
  const t = await getTranslations("plan.team");
  const locale = await getLocale();
  const own = computeOwnership({ scenario: BASE, terms: PARTNERSHIP_TERMS, schedule: OPENING_SCHEDULE, markets: FRANCHISE_MARKETS, franchiseTerms: FRANCHISE_TERMS });
  const filed = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${ENTITY.filed}T12:00:00Z`));
  const effective = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${ENTITY.effective}T12:00:00Z`));

  return (
    <div data-plan-module="team" className="flex flex-col gap-14">
      <section className="grid gap-6 md:grid-cols-[minmax(220px,300px)_1fr]">
        <PhotoPlaceholder label={t("photoLabel")} needs={t("founder.photo")} className="aspect-[4/5]" />
        <div>
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{t("founder.role", { pct: fmtPercent(own.founderPct, locale, 0) })}</p>
          <h2 className="m-0 mt-1 font-display text-[2rem] leading-tight text-oh-cream">{t("founder.name")}</h2>
          <p className="m-0 mt-4 text-[1rem] leading-relaxed text-oh-mute">{t("founder.bio")}</p>
          <ul className="m-0 mt-4 grid list-none gap-2 p-0 text-[0.85rem] sm:grid-cols-2">
            {(["commerce", "scale", "markets", "languages"] as const).map((k) => (
              <li key={k} className="rounded-md border border-oh-stone bg-oh-ink px-3 py-2 text-oh-cream">{t(`founder.facts.${k}`)}</li>
            ))}
          </ul>
          <p className="m-0 mt-4 font-display text-[1.15rem] leading-snug text-oh-cream">{t("founder.thesis")}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-dashed border-oh-gold/60 bg-oh-ink p-5">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{t("partner.role", { pct: fmtPercent(own.partnerPct, locale, 0) })}</p>
          <h2 className="m-0 mt-1 font-display text-[1.5rem] text-oh-cream">{t("partner.title")}</h2>
          <p className="m-0 mt-3 text-[0.9rem] leading-relaxed text-oh-mute">{t("partner.body", { capital: fmtCompact(PARTNERSHIP_TERMS.partnerCapital, { locale }), cap: fmtPercent(PARTNERSHIP_TERMS.partnerPctCap, locale, 0) })}</p>
        </div>
        <div className="rounded-lg border border-oh-stone bg-oh-ink p-5">
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{t("entity.title")}</p>
          <h2 className="m-0 mt-1 font-display text-[1.3rem] text-oh-cream">{ENTITY.name}</h2>
          <dl className="m-0 mt-3 grid grid-cols-[8rem_1fr] gap-y-1.5 text-[0.85rem]">
            <dt className="text-oh-mute">{t("entity.number")}</dt><dd className="m-0 tabular-nums text-oh-cream">{ENTITY.utahEntity}</dd>
            <dt className="text-oh-mute">{t("entity.filed")}</dt><dd className="m-0 text-oh-cream">{filed}</dd>
            <dt className="text-oh-mute">{t("entity.effective")}</dt><dd className="m-0 text-oh-cream">{effective}</dd>
            <dt className="text-oh-mute">{t("entity.office")}</dt><dd className="m-0 text-oh-cream">{ENTITY.office}</dd>
            <dt className="text-oh-mute">{t("entity.structure")}</dt><dd className="m-0 text-oh-cream">{t("entity.structureValue")}</dd>
          </dl>
          <p className="m-0 mt-3 text-[0.72rem] text-oh-ash">{t("entity.note")}</p>
        </div>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("advisory.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("advisory.subtitle")}</p>
        <div className="grid gap-3 md:grid-cols-3">
          {(["operator", "culinary", "franchise"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-dashed border-oh-stone p-4">
              <p className="m-0 font-display text-[1.1rem] text-oh-cream">{t(`advisory.seats.${k}.title`)}</p>
              <p className="m-0 mt-1 text-[0.82rem] leading-snug text-oh-mute">{t(`advisory.seats.${k}.why`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">{t("hiring.title")}</h2>
        <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("hiring.subtitle")}</p>
        <ol className="m-0 list-none p-0">
          {(["preOpening", "flagship", "beforeThree", "fiveUnits", "franchise"] as const).map((k) => {
            const key = k === "beforeThree";
            return (
              <li key={k} className={["grid gap-2 border-l-2 py-3 pl-4 md:grid-cols-[10rem_1fr]", key ? "border-oh-ember" : "border-oh-stone"].join(" ")}>
                <span className={["text-[0.8rem] tabular-nums", key ? "text-oh-ember" : "text-oh-mute"].join(" ")}>{t(`hiring.phases.${k}.when`)}</span>
                <div>
                  <p className="m-0 font-display text-[1.05rem] text-oh-cream">{t(`hiring.phases.${k}.title`)}</p>
                  <p className="m-0 mt-1 text-[0.82rem] leading-snug text-oh-mute">{t(`hiring.phases.${k}.body`)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
