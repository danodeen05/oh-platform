"use client";

import Image from "next/image";

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
  const badges: { label: string; src: string }[] = [];

  if (isVegan) {
    badges.push({
      label: labels.vegan || "Vegan",
      src: "/allergens/vegan.png",
    });
  } else if (isVegetarian) {
    badges.push({
      label: labels.vegetarian || "Vegetarian",
      src: "/allergens/vegetarian.png",
    });
  }

  if (isGlutenFree) {
    badges.push({
      label: labels.glutenFree || "Gluten-Free",
      src: "/allergens/gluten-free.png",
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
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px", alignItems: "center" }}>
      {badges.map((badge, idx) => (
        <Image
          key={idx}
          src={badge.src}
          alt={badge.label}
          title={badge.label}
          width={20}
          height={20}
          style={{ objectFit: "contain" }}
        />
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
