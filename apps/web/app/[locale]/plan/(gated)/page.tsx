import { getTranslations } from "next-intl/server";
import { getPlanSession } from "@/lib/plan/session.server";

export default async function PlanHomePage() {
  const claims = await getPlanSession();
  const t = await getTranslations("plan.shell");
  return (
    <section>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: "2rem", margin: "0 0 12px" }}>
        {t("authenticated")}
      </h1>
      <p style={{ color: "#9A9188" }}>
        {claims?.aud} · {claims?.scn} · {claims && claims.sec.length > 0 ? claims.sec.join(", ") : "all sections"}
      </p>
    </section>
  );
}
