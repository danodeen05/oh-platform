"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getMenuItemImage } from "@/lib/menu-images";

// CSS for custom slider thumb styling (matching kiosk)
const sliderStyles = `
  input[type="range"].web-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type="range"].web-slider::-webkit-slider-runnable-track {
    height: 8px;
    background: #e5e5e5;
    border-radius: 4px;
  }

  input[type="range"].web-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 28px;
    height: 28px;
    background: #5A5847;
    border-radius: 50%;
    margin-top: -10px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    border: 2px solid #FFFFFF;
    transition: transform 0.15s ease;
  }

  input[type="range"].web-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  input[type="range"].web-slider::-moz-range-track {
    height: 8px;
    background: #e5e5e5;
    border-radius: 4px;
  }

  input[type="range"].web-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: #5A5847;
    border-radius: 50%;
    border: 2px solid #FFFFFF;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
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
};

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
}: SliderControlProps) {
  const { min, max, labels, step } = config;
  const defaultValue = config.default ?? 0;
  // Use English name for image lookup, fallback to localized name
  const itemImage = getMenuItemImage(nameEn || name);

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

  return (
    <>
      <style>{sliderStyles}</style>
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
            {/* Header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1a1a1a" }}>{name}</span>
              <span
                style={{
                  padding: "4px 12px",
                  background: "#5A5847",
                  borderRadius: 12,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                }}
              >
                {getTranslatedLabel(labels[value]) || value}
              </span>
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

            {/* Slider with padding for thumb overflow */}
            <div style={{ position: "relative", paddingLeft: 14, paddingRight: 14 }}>
              <input
                type="range"
                className="web-slider"
                min={min}
                max={max}
                value={value}
                step={step}
                onChange={(e) => handleChange(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  height: 28,
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Labels below slider - show ALL labels with dotted border on default */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: "0.8rem",
                paddingLeft: 14,
                paddingRight: 14,
              }}
            >
              {labels.map((label, i) => {
                const isDefault = i === defaultValue;
                const isSelected = value === i;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <span
                      style={{
                        color: isSelected ? "#5A5847" : "#666",
                        fontWeight: isSelected ? 700 : 400,
                        fontSize: isSelected ? "0.85rem" : "0.8rem",
                        transition: "all 0.15s ease",
                        padding: isDefault ? "3px 8px" : undefined,
                        border: isDefault ? "2px dashed #7C7A67" : undefined,
                        borderRadius: isDefault ? 6 : undefined,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getTranslatedLabel(label)}
                    </span>
                  </div>
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
