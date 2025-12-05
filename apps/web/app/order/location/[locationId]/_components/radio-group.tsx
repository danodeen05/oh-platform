"use client";

type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  description?: string;
};

type RadioGroupProps = {
  title: string;
  items: MenuItem[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
};

export function RadioGroup({ title, items, selectedId, onSelect }: RadioGroupProps) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 16, fontSize: "1.1rem", fontWeight: "600" }}>
        {title}
      </h3>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                border: `2px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: 16,
                background: isSelected ? "#f0f4ff" : "white",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "1rem", marginBottom: 4 }}>
                    {item.name}
                  </div>
                  {item.description && (
                    <div style={{ color: "#666", fontSize: "0.875rem", marginBottom: 4 }}>
                      {item.description}
                    </div>
                  )}
                  <div style={{ color: "#7C7A67", fontWeight: "600", fontSize: "0.95rem" }}>
                    {item.basePriceCents > 0
                      ? `$${(item.basePriceCents / 100).toFixed(2)}`
                      : "Included"}
                  </div>
                </div>
                {isSelected && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#7C7A67",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                      marginLeft: 12,
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
