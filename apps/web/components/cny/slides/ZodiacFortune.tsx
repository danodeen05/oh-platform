"use client";

import { useTranslations } from "next-intl";

interface ZodiacFortuneProps {
  lookForwardTo: string;
  thingsToAvoid: string;
}

export function ZodiacFortune({
  lookForwardTo,
  thingsToAvoid,
}: ZodiacFortuneProps) {
  const t = useTranslations("cny.slides");
  return (
    <div className="slide-section fortune-section-combined">
      <div className="fortune-block">
        <h3 className="fortune-subtitle">
          {t("lookForward")}
        </h3>
        <p className="fortune-text">{lookForwardTo}</p>
      </div>

      <div className="fortune-divider" />

      <div className="fortune-block">
        <h3 className="fortune-subtitle">
          {t("avoid")}
        </h3>
        <p className="fortune-text">{thingsToAvoid}</p>
      </div>
    </div>
  );
}
