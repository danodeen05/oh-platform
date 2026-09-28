"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getMenuItemImage } from "@/lib/menu-images";
import { DietaryBadges } from "./dietary-badges";

// CSS for pulsating animation on Extra Spicy
const pulseStyles = `
  @keyframes spicePulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.2);
    }
  }
  .spice-pulse {
    animation: spicePulse 1.5s ease-in-out infinite;
  }
`;

type SliderConfig = {
  min: number;
  max: number;
  default: number;
  labels: string[];
  labelPositions?: number[];
  step: number;
  description?: string;
};

type DietaryLabels = {
  vegetarian?: string;
  vegan?: string;
  glutenFree?: string;
  spiceMild?: string;
  spiceMedium?: string;
  spiceHot?: string;
};

type SliderControlProps = {
  name: string;
  nameEn?: string; // English name for image lookups
  description?: string;
  value: number;
  onChange: (value: number) => void;
  config: SliderConfig;
  pricingInfo?: {
    basePriceCents: number;
    additionalPriceCents: number;
    includedQuantity: number;
  };
  labelTranslations?: Record<string, string>; // Map English labels to translated labels
  includedUpToLabel?: string; // Translated "Included (up to X)" text
  // Dietary information
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number; // 0=none, 1=mild, 2=medium, 3=hot
  dietaryLabels?: DietaryLabels;
};

// Heat colors for spice levels (index 0 = None, no color)
const spiceColors = [
  null,                    // 0: None - no heat color
  "rgba(244, 114, 182, 0.6)", // 1: Mild - pinkish
  "rgba(239, 68, 68, 0.7)",   // 2: Medium - red
  "rgba(220, 38, 38, 0.85)",  // 3: Spicy - deeper red
  "rgba(185, 28, 28, 1)",     // 4: Extra Spicy - intense red
];

export function SliderControl({
  name,
  nameEn,
  description,
  value,
  onChange,
  config,
  pricingInfo,
  labelTranslations,
  includedUpToLabel,
  isVegetarian,
  isVegan,
  isGlutenFree,
  spiceLevel,
  dietaryLabels,
}: SliderControlProps) {
  const { labels } = config;
  const defaultValue = config.default ?? 0;
  // Use English name for image lookup, fallback to localized name
  const itemImage = getMenuItemImage(nameEn || name);

  // Check if this is the spice level control
  const isSpiceLevel = nameEn?.toLowerCase().includes("spice") || name.toLowerCase().includes("spice");

  // Helper to get translated label
  const getTranslatedLabel = (label: string) => {
    return labelTranslations?.[label] || label;
  };

  // Track if value was just changed for animation
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    if (justChanged) {
      const timer = setTimeout(() => setJustChanged(false), 200);
      return () => clearTimeout(timer);
    }
  }, [justChanged]);

  const handleChange = (newValue: number) => {
    setJustChanged(true);
    onChange(newValue);
  };

  // Get spice styling for the segmented control container
  const getSpiceContainerStyle = () => {
    if (!isSpiceLevel || value === 0) return {};

    const color = spiceColors[value] || spiceColors[spiceColors.length - 1];
    const borderWidth = value === 4 ? 3 : 2; // Thicker for Extra Spicy

    return {
      border: `${borderWidth}px solid ${color}`,
      boxShadow: value >= 3 ? `0 0 8px ${color}` : undefined,
    };
  };

  const isExtraSpicy = isSpiceLevel && value === 4;

  return (
    <>
      {isSpiceLevel && <style>{pulseStyles}</style>}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "white",
          transition: "all 0.2s",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {/* Image */}
          {itemImage && (
            <div
              style={{
                width: 70,
                minHeight: 80,
                position: "relative",
                flexShrink: 0,
                background: "#f5f5f5",
              }}
            >
              <Image
                src={itemImage}
                alt={name}
                fill
                style={{ objectFit: "cover" }}
                sizes="70px"
              />
            </div>
          )}
          {/* Content */}
          <div style={{ flex: 1, padding: "12px 14px" }}>
            {/* Header row - name and dietary badges */}
            <div
              style={{
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1a1a1a" }}>{name}</span>
              <DietaryBadges
                isVegetarian={isVegetarian}
                isVegan={isVegan}
                isGlutenFree={isGlutenFree}
                spiceLevel={spiceLevel}
                labels={dietaryLabels}
              />
            </div>

            {/* Pricing info */}
            {pricingInfo && pricingInfo.includedQuantity > 0 && (
              <div style={{ fontSize: "0.8rem", marginBottom: 8 }}>
                {value <= pricingInfo.includedQuantity ? (
                  <span style={{ color: "#22c55e" }}>
                    {includedUpToLabel || `Included (up to ${pricingInfo.includedQuantity})`}
                  </span>
                ) : (
                  <span style={{ color: "#7C7A67" }}>
                    +${((pricingInfo.additionalPriceCents * (value - pricingInfo.includedQuantity)) / 100).toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {/* Segmented control - clickable buttons for each option */}
            <div
              className={isExtraSpicy ? "spice-pulse" : undefined}
              style={{
                display: "flex",
                background: "#e5e5e5",
                borderRadius: 20,
                padding: 3,
                gap: 2,
                transition: "all 0.3s ease",
                ...getSpiceContainerStyle(),
              }}
            >
              {labels.map((label, i) => {
                const isDefault = i === defaultValue;
                const isSelected = value === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleChange(i)}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      border: "none",
                      borderRadius: 16,
                      background: isSelected ? "#5A5847" : "transparent",
                      color: isSelected ? "#FFFFFF" : "#666",
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      position: "relative",
                      outline: isDefault && !isSelected ? "2px dashed #7C7A67" : "none",
                      outlineOffset: -2,
                    }}
                  >
                    {getTranslatedLabel(label)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Legend component for slider recommendation indicator
export function SliderLegend({ recommendationLabel = "Oh! Recommendation" }: { recommendationLabel?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        marginBottom: 16,
        fontSize: "0.85rem",
        color: "#1a1a1a",
      }}
    >
      <div
        style={{
          width: 40,
          height: 22,
          borderRadius: 6,
          border: "2px dashed #7C7A67",
        }}
      />
      <span style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: "1.1rem" }}>=</span>{" "}
        <span style={{ fontFamily: '"Ma Shan Zheng", cursive', color: "#C7A878", fontSize: "1.1rem" }}>哦</span>{" "}
        {recommendationLabel}
      </span>
    </div>
  );
}
