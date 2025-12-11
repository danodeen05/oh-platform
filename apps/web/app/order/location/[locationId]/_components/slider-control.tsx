"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getMenuItemImage } from "@/lib/menu-images";

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
  description?: string;
  value: number;
  onChange: (value: number) => void;
  config: SliderConfig;
  pricingInfo?: {
    basePriceCents: number;
    additionalPriceCents: number;
    includedQuantity: number;
  };
};

// Custom SVG icons for items where emojis don't exist or look wrong
// Green onions (scallions) - long green stalks
const GreenOnionIcon = ({ size = 24, count = 1 }: { size?: number; count?: number }) => (
  <svg width={size * count} height={size} viewBox={`0 0 ${24 * count} 24`} fill="none">
    {Array.from({ length: count }).map((_, i) => (
      <g key={i} transform={`translate(${i * 24}, 0)`}>
        {/* White bulb at bottom */}
        <ellipse cx="12" cy="20" rx="3" ry="3" fill="#f0f0e8" stroke="#d4d4c0" strokeWidth="0.5"/>
        {/* Green stalk */}
        <path d="M10 20 C10 14 8 8 9 2 L12 2 C11 8 11 14 12 20 Z" fill="#22c55e"/>
        <path d="M12 20 C13 14 13 8 12 2 L15 2 C16 8 14 14 14 20 Z" fill="#16a34a"/>
        {/* Roots */}
        <path d="M10 21 Q9 23 8 24 M12 22 Q12 23 12 24 M14 21 Q15 23 16 24" stroke="#d4d4c0" strokeWidth="0.5" fill="none"/>
      </g>
    ))}
  </svg>
);

// Bean sprouts - white with small yellow bean heads
const SproutsIcon = ({ size = 24, count = 1 }: { size?: number; count?: number }) => (
  <svg width={size * count} height={size} viewBox={`0 0 ${24 * count} 24`} fill="none">
    {Array.from({ length: count }).map((_, i) => (
      <g key={i} transform={`translate(${i * 24}, 0)`}>
        {/* Bean head */}
        <ellipse cx="12" cy="5" rx="4" ry="3" fill="#fef3c7" stroke="#fcd34d" strokeWidth="0.5"/>
        {/* Sprout body - white/cream wavy stem */}
        <path d="M12 8 C14 10 10 14 13 18 C14 20 11 22 12 24" stroke="#f5f5f0" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M12 8 C14 10 10 14 13 18 C14 20 11 22 12 24" stroke="#e8e8e0" strokeWidth="2" strokeLinecap="round" fill="none"/>
        {/* Small root tail */}
        <path d="M12 22 Q10 23 9 24 M12 23 Q14 24 15 24" stroke="#d4c4a0" strokeWidth="0.5" fill="none"/>
      </g>
    ))}
  </svg>
);

// Pickled mustard greens - dark green leafy with crinkled texture
const PickledGreensIcon = ({ size = 24, count = 1 }: { size?: number; count?: number }) => (
  <svg width={size * count} height={size} viewBox={`0 0 ${24 * count} 24`} fill="none">
    {Array.from({ length: count }).map((_, i) => (
      <g key={i} transform={`translate(${i * 24}, 0)`}>
        {/* Stem */}
        <path d="M12 22 L12 10" stroke="#a3a355" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Crinkled leaf - darker olive/brown for pickled look */}
        <path d="M12 10 C6 8 4 4 8 2 C10 3 12 4 12 6 C12 4 14 3 16 2 C20 4 18 8 12 10" fill="#7c8c3c" stroke="#5c6c2c" strokeWidth="0.5"/>
        {/* Texture lines on leaf */}
        <path d="M9 5 Q10 6 12 6 M15 5 Q14 6 12 6 M8 7 Q10 8 12 8 M16 7 Q14 8 12 8" stroke="#5c6c2c" strokeWidth="0.3" fill="none"/>
      </g>
    ))}
  </svg>
);

// Indicator types: emoji or svg
type SliderIndicator = {
  type: "emoji" | "svg";
  // For emoji type
  emojis?: string[];
  sizes?: number[];
  // For svg type
  component?: React.FC<{ size?: number; count?: number }>;
  baseSizes?: number[];
  counts?: number[];
};

// Slider configurations - using SVGs for problematic emojis
const sliderIndicators: Record<string, SliderIndicator> = {
  "Spice Level": {
    type: "emoji",
    // None → Mild → Medium → Spicy → Extra Spicy
    emojis: ["🚫", "🌶️", "🌶️", "🔥", "🔥"],
    sizes: [1.2, 1.0, 1.3, 1.5, 1.5], // Extra Spicy same size as Spicy, extra chilis added via effects
  },
  "Soup Richness": {
    type: "emoji",
    // Light → Medium → Rich → Extra Rich
    emojis: ["💧", "🍜", "🍜", "🍜"],
    sizes: [1.0, 1.2, 1.4, 1.7],
  },
  "Noodle Texture": {
    type: "emoji",
    // Firm → Medium → Soft
    emojis: ["💪", "🍜", "〰️"],
    sizes: [1.3, 1.3, 1.4],
  },
  "Baby Bok Choy": {
    type: "emoji",
    // None → Light → Normal → Extra
    emojis: ["🚫", "🥬", "🥬", "🥬"],
    sizes: [1.0, 1.0, 1.3, 1.6],
  },
  "Green Onions": {
    type: "svg",
    component: GreenOnionIcon,
    // None → Light → Normal → Extra
    baseSizes: [20, 24, 28, 32],
    counts: [0, 1, 2, 3],
  },
  "Cilantro": {
    type: "emoji",
    // None → Light → Normal → Extra
    emojis: ["🚫", "🌿", "🌿", "🌿"],
    sizes: [1.0, 1.0, 1.3, 1.6],
  },
  "Sprouts": {
    type: "svg",
    component: SproutsIcon,
    // None → Light → Normal → Extra
    baseSizes: [20, 24, 28, 32],
    counts: [0, 1, 2, 3],
  },
  "Pickled Greens": {
    type: "svg",
    component: PickledGreensIcon,
    // None → Light → Normal → Extra
    baseSizes: [20, 24, 28, 32],
    counts: [0, 1, 2, 3],
  },
};

// Get extra visual effects based on slider and value
function getExtraEffects(name: string, value: number): string {
  if (name === "Spice Level") {
    if (value === 3) return "🌶️"; // Spicy: add extra pepper
    if (value === 4) return "🌶️🌶️"; // Extra Spicy: add multiple peppers
  }
  if (name === "Soup Richness") {
    if (value === 2) return "💨"; // Rich: add steam
    if (value === 3) return "💨💨"; // Extra Rich: more steam
  }
  if (name === "Baby Bok Choy" || name === "Cilantro") {
    if (value === 3) return "+"; // Extra: show plus
  }
  return "";
}

export function SliderControl({
  name,
  description,
  value,
  onChange,
  config,
  pricingInfo,
}: SliderControlProps) {
  const { min, max, labels, labelPositions, step } = config;
  const percentage = ((value - min) / (max - min)) * 100;
  const itemImage = getMenuItemImage(name);

  // Animation state for emoji pop effect
  const [isAnimating, setIsAnimating] = useState(false);

  // Get indicator config for this slider
  const indicator = sliderIndicators[name];
  const extraEffects = getExtraEffects(name, value);

  // Trigger animation on value change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 200);
    return () => clearTimeout(timer);
  }, [value]);

  // Render the thumb indicator based on type
  const renderThumbIndicator = () => {
    if (!indicator) {
      return <span>⚪</span>;
    }

    if (indicator.type === "emoji") {
      const emoji = indicator.emojis?.[value] || "⚪";
      const size = indicator.sizes?.[value] || 1;
      return (
        <div
          style={{
            fontSize: `${1.5 * size}rem`,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span>{emoji}</span>
          {extraEffects && (
            <span style={{ fontSize: `${1.0 * size}rem`, marginLeft: -4 }}>{extraEffects}</span>
          )}
        </div>
      );
    }

    if (indicator.type === "svg" && indicator.component) {
      const SvgComponent = indicator.component;
      const svgSize = indicator.baseSizes?.[value] || 24;
      const count = indicator.counts?.[value] ?? 1;

      // For "None" state (count = 0), show the 🚫 emoji instead
      if (count === 0) {
        return <span style={{ fontSize: "1.5rem" }}>🚫</span>;
      }

      return <SvgComponent size={svgSize} count={count} />;
    }

    return <span>⚪</span>;
  };

  // Calculate animation scale based on indicator type
  const getAnimationScale = () => {
    if (indicator?.type === "emoji") {
      return isAnimating ? 1.3 : 1;
    }
    // SVG animations are subtler
    return isAnimating ? 1.15 : 1;
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: value > min ? "#f9fafb" : "white",
        transition: "all 0.2s",
        overflow: "visible", // Allow slider thumb to extend past edges
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Image */}
        {itemImage && (
          <div
            style={{
              width: 80,
              minHeight: 100,
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
              sizes="80px"
            />
          </div>
        )}
        {/* Content */}
        <div style={{ flex: 1, padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <strong style={{ fontSize: "1rem" }}>{name}</strong>
              <span
                style={{
                  fontWeight: "bold",
                  color: "#7C7A67",
                  fontSize: "0.95rem",
                }}
              >
                {labels[value] || value}
              </span>
            </div>
            {description && (
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 8 }}>
                {description}
              </div>
            )}
            {pricingInfo && pricingInfo.includedQuantity > 0 && (
              <div style={{ fontSize: "0.85rem" }}>
                {value <= pricingInfo.includedQuantity ? (
                  <span style={{ color: "#22c55e" }}>
                    ✓ Included (up to {pricingInfo.includedQuantity})
                  </span>
                ) : (
                  <span style={{ color: "#7C7A67" }}>
                    +${((pricingInfo.additionalPriceCents * (value - pricingInfo.includedQuantity)) / 100).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Custom Slider with Emoji/SVG Thumb */}
          {/* Overflow visible allows indicators to extend past container */}
          <div style={{ position: "relative", height: 56, display: "flex", alignItems: "center", overflow: "visible" }}>
            {/* Track - with margin right to give space for thumb overflow */}
            <div
              style={{
                width: "100%",
                height: 10,
                borderRadius: 5,
                background: `linear-gradient(to right, #7C7A67 0%, #7C7A67 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
                position: "relative",
                marginRight: 20, // Space for thumb overflow at end
              }}
            />

            {/* Indicator Thumb Overlay */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${percentage}%`,
                transform: `translate(-50%, -50%) scale(${getAnimationScale()})`,
                cursor: "grab",
                transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.1s ease-out",
                filter: isAnimating ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                userSelect: "none",
                pointerEvents: "none",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                lineHeight: 1,
                whiteSpace: "nowrap", // Prevent wrapping of multi-icon indicators
              }}
            >
              {renderThumbIndicator()}
            </div>

            {/* Invisible native slider for accessibility and interaction */}
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              step={step}
              onChange={(e) => onChange(parseInt(e.target.value))}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
                margin: 0,
                zIndex: 3,
              }}
              className="slider-input"
            />
          </div>

          {/* Labels */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              color: "#999",
              marginTop: 16,
            }}
          >
            {labelPositions ? (
              <>
                {labelPositions.map((pos, i) => (
                  <span key={i} style={{ flex: 1, textAlign: pos === 0 ? 'left' : pos === max ? 'right' : 'center' }}>
                    {labels[i]}
                  </span>
                ))}
              </>
            ) : (
              <>
                <span>{labels[0]}</span>
                <span>{labels[labels.length - 1]}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
