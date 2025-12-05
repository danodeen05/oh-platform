"use client";

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

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        background: value > min ? "#f9fafb" : "white",
        transition: "all 0.2s",
      }}
    >
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

      {/* Slider Input */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{
          width: "100%",
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right, #7C7A67 0%, #7C7A67 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          outline: "none",
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
        }}
        className="slider-input"
      />

      {/* Labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "#999",
          marginTop: 8,
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

      <style jsx>{`
        .slider-input::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7C7A67;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7C7A67;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
