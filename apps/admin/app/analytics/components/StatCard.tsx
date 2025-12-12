"use client";

type StatCardProps = {
  title: string;
  value: string | number;
  change?: string;
  subtitle?: string;
  icon?: string;
  color?: "green" | "red" | "blue" | "yellow" | "default";
};

export default function StatCard({ title, value, change, subtitle, icon, color = "default" }: StatCardProps) {
  const changeNum = change ? parseFloat(change) : 0;
  const isPositive = changeNum > 0;
  const isNegative = changeNum < 0;

  const colorMap = {
    green: { bg: "#ecfdf5", border: "#10b981", text: "#059669" },
    red: { bg: "#fef2f2", border: "#ef4444", text: "#dc2626" },
    blue: { bg: "#eff6ff", border: "#3b82f6", text: "#2563eb" },
    yellow: { bg: "#fffbeb", border: "#f59e0b", text: "#d97706" },
    default: { bg: "#f9fafb", border: "#e5e7eb", text: "#374151" },
  };

  const colors = colorMap[color];

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "12px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: "0.875rem", color: "#6b7280", fontWeight: 500 }}>{title}</span>
        {icon && <span style={{ fontSize: "1.5rem" }}>{icon}</span>}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: colors.text }}>
        {value}
      </div>
      {(change || subtitle) && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem" }}>
          {change && (
            <span
              style={{
                color: isPositive ? "#10b981" : isNegative ? "#ef4444" : "#6b7280",
                fontWeight: 500,
              }}
            >
              {isPositive && "+"}{change}%
            </span>
          )}
          {subtitle && <span style={{ color: "#9ca3af" }}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
