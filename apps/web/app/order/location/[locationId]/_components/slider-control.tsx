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
        border: "1px solid rgba(124, 122, 103, 0.2)",
        borderRadius: 4,
        padding: 24,
        background: value > min ? "rgba(199, 168, 120, 0.05)" : "rgba(255, 255, 255, 0.5)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
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
          <strong style={{ fontSize: "1rem", color: "#222222", fontWeight: "400", letterSpacing: "0.5px" }}>
            {name}
          </strong>
          <span
            style={{
              fontWeight: "500",
              color: "#7C7A67",
              fontSize: "0.95rem",
              letterSpacing: "0.5px",
            }}
          >
            {labels[value] || value}
          </span>
        </div>
        {description && (
          <div style={{ fontSize: "0.85rem", color: "#666666", marginBottom: 8, fontWeight: "300" }}>
            {description}
          </div>
        )}
        {pricingInfo && pricingInfo.includedQuantity > 0 && (
          <div style={{ fontSize: "0.85rem" }}>
            {value <= pricingInfo.includedQuantity ? (
              <span style={{ color: "#7C7A67" }}>
                ✓ Included (up to {pricingInfo.includedQuantity})
              </span>
            ) : (
              <span style={{ color: "#C7A878" }}>
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
          height: 6,
          borderRadius: 3,
          background: `linear-gradient(to right, #7C7A67 0%, #7C7A67 ${percentage}%, rgba(124, 122, 103, 0.2) ${percentage}%, rgba(124, 122, 103, 0.2) 100%)`,
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
          color: "#999999",
          marginTop: 8,
          letterSpacing: "0.3px",
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
          background: #C7A878;
          cursor: pointer;
          border: 2px solid #E5E5E5;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
        }

        .slider-input::-webkit-slider-thumb:hover {
          background: #7C7A67;
          transform: scale(1.1);
        }

        .slider-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #C7A878;
          cursor: pointer;
          border: 2px solid #E5E5E5;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
        }

        .slider-input::-moz-range-thumb:hover {
          background: #7C7A67;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
