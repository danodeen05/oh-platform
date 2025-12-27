"use client";

import { ReactNode, useState } from "react";

type Column = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
};

type DataTableProps = {
  columns: Column[];
  data: Record<string, unknown>[];
  title?: string;
  expandable?: boolean;
  defaultLimit?: number;
};

function renderCell(value: unknown): ReactNode {
  // If it's already a valid React node (string, number, element), render it directly
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  // Check if it's a React element (has $$typeof)
  if (typeof value === "object" && value !== null && "$$typeof" in value) {
    return value as unknown as ReactNode;
  }
  // Fallback to string conversion
  return String(value);
}

export default function DataTable({ columns, data, title, expandable = false, defaultLimit = 10 }: DataTableProps) {
  const [expanded, setExpanded] = useState(false);

  const displayData = expandable && !expanded ? data.slice(0, defaultLimit) : data;
  const hasMore = expandable && data.length > defaultLimit;

  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#374151", margin: 0 }}>{title}</h3>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: "6px 12px",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "#3b82f6",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {expanded ? `Show Top ${defaultLimit}` : `View All (${data.length})`}
            </button>
          )}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "12px 20px",
                    textAlign: col.align || "left",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "0.875rem",
                  }}
                >
                  No data available
                </td>
              </tr>
            ) : (
              displayData.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < displayData.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "14px 20px",
                        textAlign: col.align || "left",
                        fontSize: "0.875rem",
                        color: "#374151",
                      }}
                    >
                      {renderCell(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
