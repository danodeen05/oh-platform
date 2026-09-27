"use client";

import type { CateringEventStatus } from "./types";

const STATUS_COLORS: Record<CateringEventStatus, { bg: string; text: string; label: string }> = {
  PLANNING: { bg: "#dbeafe", text: "#1e40af", label: "Planning" },
  ENRICHING: { bg: "#fef3c7", text: "#92400e", label: "Enriching..." },
  NEEDS_REVIEW: { bg: "#fde8d8", text: "#9a3412", label: "Needs Review" },
  LIVE: { bg: "#d1fae5", text: "#065f46", label: "Live" },
  COMPLETED: { bg: "#f3f4f6", text: "#374151", label: "Completed" },
};

export default function StatusBadge({ status }: { status: CateringEventStatus }) {
  const colors = STATUS_COLORS[status] || { bg: "#f3f4f6", text: "#374151", label: status };

  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 4,
        fontSize: "0.8rem",
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.text,
        whiteSpace: "nowrap",
      }}
    >
      {colors.label}
    </span>
  );
}
