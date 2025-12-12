"use client";

type DataPoint = {
  label: string;
  value: number;
  formatted?: string;
};

type SimpleBarChartProps = {
  data: DataPoint[];
  title?: string;
  color?: string;
  height?: number;
};

export default function SimpleBarChart({ data, title, color = "#3b82f6", height = 200 }: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
      {title && (
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "#374151" }}>
          {title}
        </h3>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height }}>
        {data.map((point, i) => {
          const barHeight = (point.value / maxValue) * height * 0.8;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "40px",
                  height: barHeight || 2,
                  background: color,
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s",
                }}
                title={point.formatted || String(point.value)}
              />
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#9ca3af",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
