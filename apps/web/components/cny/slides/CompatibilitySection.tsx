"use client";

import { useTranslations } from "next-intl";
import { Attendee } from "@/lib/cny/slides-data";

interface CompatibilitySectionProps {
  title: string;
  icon?: string;
  attendees: Attendee[];
  type: "compatible" | "avoid";
}

export function CompatibilitySection({
  title,
  icon,
  attendees,
  type,
}: CompatibilitySectionProps) {
  const t = useTranslations("cny");
  // Group attendees by zodiac for display
  const byZodiac = attendees.reduce(
    (acc, attendee) => {
      if (attendee.zodiac) {
        if (!acc[attendee.zodiac]) {
          acc[attendee.zodiac] = [];
        }
        // Get first name only
        const firstName = attendee.name.trim().split(" ")[0];
        acc[attendee.zodiac].push(firstName);
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  const zodiacEntries = Object.entries(byZodiac);

  return (
    <div className={`slide-section compatibility-section ${type}`}>
      <h2 className="section-header">
        {icon ? <span className="section-header-icon">{icon}</span> : null}
        {title}
      </h2>
      {zodiacEntries.length > 0 ? (
        <div className="compatibility-names">
          {zodiacEntries.map(([zodiac, names], i) => (
            <span key={zodiac} className="compatibility-item">
              <span className="compatibility-name">
                {names.join(", ")}
              </span>
              {" "}
              <span className="compatibility-zodiac">({t(`zodiac.animals.${zodiac}`)})</span>
              {i < zodiacEntries.length - 1 && " · "}
            </span>
          ))}
        </div>
      ) : (
        <p className="no-attendees">
          {type === "compatible" ? t("slides.noneCompatible") : t("slides.coastClear")}
        </p>
      )}
    </div>
  );
}
