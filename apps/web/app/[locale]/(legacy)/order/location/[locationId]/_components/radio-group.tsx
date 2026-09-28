"use client";

import Image from "next/image";
import { getMenuItemImage, isNoNoodlesItem } from "@/lib/menu-images";
import { DietaryBadges } from "./dietary-badges";

type MenuItem = {
  id: string;
  name: string;
  nameEn?: string; // English name for image lookups
  basePriceCents: number;
  description?: string;
  // Dietary information
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number; // 0=none, 1=mild, 2=medium, 3=hot
};

type DietaryLabels = {
  vegetarian?: string;
  vegan?: string;
  glutenFree?: string;
  spiceMild?: string;
  spiceMedium?: string;
  spiceHot?: string;
};

type RadioGroupProps = {
  title: string;
  items: MenuItem[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
  required?: boolean; // Whether this is a mandatory selection
  requiredLabel?: string; // Translated label for "Required"
  dietaryLabels?: DietaryLabels; // Translated labels for dietary badges
};

// Oh! character mark component for selected mandatory items
function OhCheckmark() {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        background: "rgba(245, 243, 239, 0.9)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: "1.3rem", color: "#C7A878", lineHeight: 1 }}>哦!</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="3">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
  );
}

export function RadioGroup({ title, items, selectedId, onSelect, required = false, requiredLabel = "Required", dietaryLabels }: RadioGroupProps) {
  const hasSelection = !!selectedId;

  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 16, fontSize: "1.1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: 8 }}>
        {title}
        {required && (
          <span style={{ color: "#7C7A67", fontSize: "0.8rem", fontWeight: 500 }}>
            {requiredLabel}
          </span>
        )}
      </h3>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          // Grey out unselected items when a selection has been made (for required sections)
          const isGreyedOut = required && hasSelection && !isSelected;

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                border: `2px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: 0,
                background: isSelected ? "#f9fafb" : "white",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                overflow: "hidden",
                opacity: isGreyedOut ? 0.5 : 1,
                filter: isGreyedOut ? "grayscale(50%)" : "none",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                {/* Image - use English name for lookup */}
                {getMenuItemImage(item.nameEn || item.name) && (
                  <div
                    style={{
                      width: 100,
                      minHeight: 80,
                      position: "relative",
                      flexShrink: 0,
                      background: "#f5f5f5",
                    }}
                  >
                    <Image
                      src={getMenuItemImage(item.nameEn || item.name)!}
                      alt={item.name}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="100px"
                    />
                  </div>
                )}
                {/* No Noodles - special crossed-out image */}
                {isNoNoodlesItem(item.nameEn || item.name) && (
                  <div
                    style={{
                      width: 100,
                      minHeight: 80,
                      position: "relative",
                      flexShrink: 0,
                      background: "#f5f5f5",
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src="/menu images/Ramen Noodles.png"
                      alt="No Noodles"
                      fill
                      style={{ objectFit: "cover", opacity: 0.4, filter: "grayscale(100%)" }}
                      sizes="100px"
                    />
                    {/* Professional diagonal cross */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "140%",
                          height: 4,
                          background: "#dc2626",
                          transform: "rotate(-45deg)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "140%",
                          height: 4,
                          background: "#dc2626",
                          transform: "rotate(45deg)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "1rem", marginBottom: 4, color: "#1a1a1a" }}>
                      {item.name}
                    </div>
                    {item.description && (
                      <div style={{ color: "#666", fontSize: "0.875rem", marginBottom: 4 }}>
                        {item.description}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#7C7A67", fontWeight: "600", fontSize: "0.95rem" }}>
                        {item.basePriceCents > 0
                          ? `$${(item.basePriceCents / 100).toFixed(2)}`
                          : "Included"}
                      </span>
                      <DietaryBadges
                        isVegetarian={item.isVegetarian}
                        isVegan={item.isVegan}
                        isGlutenFree={item.isGlutenFree}
                        spiceLevel={item.spiceLevel}
                        labels={dietaryLabels}
                      />
                    </div>
                  </div>
                  {/* Oh! Checkmark for selected required items */}
                  {isSelected && required && <OhCheckmark />}
                  {/* Simple checkmark for non-required items */}
                  {isSelected && !required && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#7C7A67",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1rem",
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
