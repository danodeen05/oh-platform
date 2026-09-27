import { getFormatter, getTranslations } from "next-intl/server";
import { AskChappyButton } from "@/components/plan/chappy/AskChappyButton";
import type { ModelReview } from "./reviews";

/**
 * Outside reviews of the model. Empty until a CPA, fractional CFO, counsel
 * or advisor signs a scope; the block says how a review is recorded and
 * offers the diligence package (register, scorecard, checks, change log and
 * the engine's test suite) through Chappy, who passes the request to the
 * owner like any other escalation.
 */
export async function ReviewerSignoff({ reviews }: { reviews: readonly ModelReview[] }) {
  const t = await getTranslations("plan.integrity.signoff");
  const fmt = await getFormatter();
  return (
    <section aria-labelledby="integrity-signoff" className="rounded-lg border border-oh-stone bg-oh-ink px-5 py-5 md:px-6">
      <h2 id="integrity-signoff" className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">
        {t("title")}
      </h2>
      <p className="m-0 mb-4 max-w-2xl text-[0.85rem] leading-relaxed text-oh-mute">{t("subtitle")}</p>
      {reviews.length === 0 ? (
        <p className="m-0 mb-4 rounded-md border border-dashed border-oh-stone px-4 py-3 text-[0.85rem] text-oh-mute" data-reviews="0">
          {t("empty")}
        </p>
      ) : (
        <ul className="m-0 mb-4 flex list-none flex-col gap-3 p-0">
          {reviews.map((r) => (
            <li key={`${r.reviewer}-${r.date}`} className="rounded-md border border-oh-stone px-4 py-3 text-[0.85rem]">
              <p className="m-0 text-oh-cream">
                {r.reviewer}, {r.firm} <span className="text-oh-mute">({t(`roles.${r.role}`)})</span>
              </p>
              <p className="m-0 mt-1 text-oh-mute">{r.statement}</p>
              <p className="m-0 mt-1 text-[0.72rem] uppercase tracking-[0.12em] text-oh-mute">
                {t(`status.${r.status}`)} · {fmt.dateTime(new Date(`${r.date}T12:00:00Z`), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })} · {r.scope === "all" ? t("scopeAll") : r.scope.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <AskChappyButton
          sectionKey="integrity"
          label={t("request.cta")}
          prefill={t("request.body")}
          className="inline-flex items-center gap-2 rounded-md border border-oh-ember-deep bg-oh-ember-deep px-4 py-2 text-[0.85rem] font-semibold text-oh-cream hover:bg-oh-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream"
        />
        <p className="m-0 text-[0.78rem] text-oh-mute">{t("request.note")}</p>
      </div>
    </section>
  );
}
