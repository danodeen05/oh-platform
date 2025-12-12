"use client";

type PeriodSelectorProps = {
  value: string;
  onChange: (period: string) => void;
};

const periods = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "quarter", label: "Last 90 Days" },
  { value: "year", label: "Last Year" },
];

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: value === period.value ? "#3b82f6" : "#e5e7eb",
            background: value === period.value ? "#3b82f6" : "white",
            color: value === period.value ? "white" : "#374151",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "0.875rem",
            transition: "all 0.15s",
          }}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
