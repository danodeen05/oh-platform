"use client";

type DietaryBadgesProps = {
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number; // 0=none, 1=mild, 2=medium, 3=hot
  labels?: {
    vegetarian?: string;
    vegan?: string;
    glutenFree?: string;
    spiceMild?: string;
    spiceMedium?: string;
    spiceHot?: string;
  };
};

export function DietaryBadges({
  isVegetarian,
  isVegan,
  isGlutenFree,
  spiceLevel,
  labels = {},
}: DietaryBadgesProps) {
  const badges: { label: string; abbr: string; color: string; bgColor: string }[] = [];

  if (isVegan) {
    badges.push({
      label: labels.vegan || "Vegan",
      abbr: "VG",
      color: "#166534",
      bgColor: "#dcfce7",
    });
  } else if (isVegetarian) {
    badges.push({
      label: labels.vegetarian || "Vegetarian",
      abbr: "V",
      color: "#166534",
      bgColor: "#dcfce7",
    });
  }

  if (isGlutenFree) {
    badges.push({
      label: labels.glutenFree || "Gluten-Free",
      abbr: "GF",
      color: "#92400e",
      bgColor: "#fef3c7",
    });
  }

  const hasDietaryInfo = badges.length > 0 || (spiceLevel && spiceLevel > 0);
  if (!hasDietaryInfo) return null;

  // Get spice label based on level
  const getSpiceLabel = (level: number) => {
    switch (level) {
      case 1:
        return labels.spiceMild || "Mild";
      case 2:
        return labels.spiceMedium || "Medium";
      case 3:
        return labels.spiceHot || "Hot";
      default:
        return "";
    }
  };

  return (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
      {badges.map((badge, idx) => (
        <span
          key={idx}
          title={badge.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1px 6px",
            fontSize: "0.65rem",
            fontWeight: "700",
            borderRadius: "3px",
            background: badge.bgColor,
            color: badge.color,
            letterSpacing: "0.3px",
          }}
        >
          {badge.abbr}
        </span>
      ))}
      {spiceLevel !== undefined && spiceLevel > 0 && (
        <span
          title={getSpiceLabel(spiceLevel)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "1px",
            padding: "1px 5px",
            fontSize: "0.65rem",
            fontWeight: "600",
            borderRadius: "3px",
            background: spiceLevel >= 3 ? "#fef2f2" : spiceLevel >= 2 ? "#fff7ed" : "#fefce8",
            color: spiceLevel >= 3 ? "#dc2626" : spiceLevel >= 2 ? "#ea580c" : "#ca8a04",
          }}
        >
          {Array.from({ length: spiceLevel }).map((_, i) => (
            <span key={i}>🌶️</span>
          ))}
        </span>
      )}
    </div>
  );
}
