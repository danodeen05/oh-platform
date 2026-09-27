import { getTranslations } from "next-intl/server";

/**
 * The vision (owner decision 2026-09-27, "Care in every bowl"). Opens the
 * Summary and the print route: one sentence, set large, so it can be lifted
 * straight into a deck or an email. Async server component, print-safe.
 */
export async function VisionStatement({ tone = "dark", className, id = "plan-vision" }: { tone?: "dark" | "light"; className?: string; id?: string }) {
  const t = await getTranslations("plan.summary.vision");
  const dark = tone === "dark";
  return (
    <section data-plan-vision="" aria-labelledby={id} className={["border-l-2 border-oh-ember pl-5 md:pl-7", className ?? ""].join(" ")}>
      <p id={id} className={["m-0 text-[0.72rem] uppercase tracking-[0.18em]", dark ? "text-oh-ember-light" : "text-oh-ember-deep"].join(" ")}>
        {t("eyebrow")}
      </p>
      <p className={["m-0 mt-3 max-w-[40ch] font-display text-[clamp(1.45rem,3.2vw,2.3rem)] leading-[1.2] [text-wrap:balance]", dark ? "text-oh-cream" : "text-oh-charcoal"].join(" ")}>
        {t("text")}
      </p>
    </section>
  );
}
