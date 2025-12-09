"use client";

import Image from "next/image";
import { getMenuItemImage } from "@/lib/menu-images";

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
  maxQuantity,
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

          // Calculate price for this item
          let itemPrice = 0;
          if (qty > 0) {
            if (qty <= item.includedQuantity) {
              itemPrice = 0; // All included
            } else if (item.includedQuantity > 0) {
              // Some included, charge for extras
              const extraQty = qty - item.includedQuantity;
              itemPrice = item.basePriceCents + item.additionalPriceCents * (extraQty - 1);
            } else {
              // Standard pricing
              itemPrice = item.basePriceCents + item.additionalPriceCents * (qty - 1);
            }
          }

          return (
            <div
              key={item.id}
              style={{
                border: `1px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
                borderRadius: 12,
                background: isSelected ? "#f9fafb" : "white",
                transition: "all 0.2s",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                {/* Image */}
                {getMenuItemImage(item.name) && (
                  <div
                    style={{
                      width: 80,
                      minHeight: 80,
                      position: "relative",
                      flexShrink: 0,
                      background: "#f5f5f5",
                    }}
                  >
                    <Image
                      src={getMenuItemImage(item.name)!}
                      alt={item.name}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="80px"
                    />
                  </div>
                )}
                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    padding: 16,
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
                    <div style={{ fontSize: "0.875rem" }}>
                      {item.includedQuantity > 0 ? (
                        <span style={{ color: "#22c55e" }}>
                          {item.includedQuantity} included
                          {item.additionalPriceCents > 0 && (
                            <span style={{ color: "#666" }}>
                              {" "}• +${(item.additionalPriceCents / 100).toFixed(2)} each extra
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: "#7C7A67", fontWeight: "600" }}>
                          +${(item.basePriceCents / 100).toFixed(2)} each
                        </span>
                      )}
                    </div>
                    {isSelected && itemPrice > 0 && (
                      <div
                        style={{
                          color: "#7C7A67",
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
                      disabled={maxQuantity !== undefined && qty >= maxQuantity}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        background: maxQuantity !== undefined && qty >= maxQuantity ? "#d1d5db" : "#7C7A67",
                        color: "white",
                        cursor: maxQuantity !== undefined && qty >= maxQuantity ? "not-allowed" : "pointer",
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
