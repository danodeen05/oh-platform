"use client";

type Column = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
};

type DataTableProps = {
  columns: Column[];
  data: Record<string, unknown>[];
  title?: string;
};

export default function DataTable({ columns, data, title }: DataTableProps) {
  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#374151", margin: 0 }}>{title}</h3>
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
            {data.length === 0 ? (
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
              data.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < data.length - 1 ? "1px solid #f3f4f6" : "none",
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
                      {String(row[col.key] ?? "-")}
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
