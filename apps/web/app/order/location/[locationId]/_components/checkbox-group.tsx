"use client";

type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  description?: string;
};

type CheckboxGroupProps = {
  title: string;
  items: MenuItem[];
  quantities: Record<string, number>;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  maxQuantity?: number;
};

export function CheckboxGroup({
  title,
  items,
  quantities,
  onUpdateQuantity,
  maxQuantity = 99,
}: CheckboxGroupProps) {
  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 16, fontSize: "1.1rem", fontWeight: "600" }}>
        {title}
      </h3>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => {
          const qty = quantities[item.id] || 0;
          const isSelected = qty > 0;

          // Calculate price for this item - these are all add-ons with no included quantity
          const itemPrice = qty > 0 ? item.basePriceCents * qty : 0;

          return (
            <div
              key={item.id}
              style={{
                border: `1px solid ${isSelected ? "#667eea" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: 16,
                background: isSelected ? "#f9fafb" : "white",
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
                  <div style={{ fontSize: "0.875rem", color: "#667eea", fontWeight: "600" }}>
                    +${(item.basePriceCents / 100).toFixed(2)} each
                  </div>
                  {isSelected && itemPrice > 0 && (
                    <div
                      style={{
                        color: "#667eea",
                        fontWeight: "600",
                        fontSize: "0.95rem",
                        marginTop: 4,
                      }}
                    >
                      Subtotal: ${(itemPrice / 100).toFixed(2)}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 12 }}>
                  {isSelected && (
                    <>
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          border: "1px solid #d1d5db",
                          background: "white",
                          cursor: "pointer",
                          fontSize: "1.2rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          minWidth: 24,
                          textAlign: "center",
                          fontWeight: "600",
                          fontSize: "1rem",
                        }}
                      >
                        {qty}
                      </span>
                    </>
                  )}
                  <button
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    disabled={qty >= maxQuantity}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "none",
                      background: qty >= maxQuantity ? "#d1d5db" : "#667eea",
                      color: "white",
                      cursor: qty >= maxQuantity ? "not-allowed" : "pointer",
                      fontSize: "1.2rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
