"use client";

import { useState, useEffect, useTransition } from "react";
import DataTable from "../../../analytics/components/DataTable";
import type { ShoppingListItem } from "../../_components/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface ShoppingTabProps {
  eventId: string;
}

export default function ShoppingTab({ eventId }: ShoppingTabProps) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/catering/events/${eventId}/shopping-list`);
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch shopping list:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [eventId]);

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${BASE}/admin/catering/events/${eventId}/shopping-list`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to generate shopping list");
          return;
        }
        await fetchList();
      } catch (err) {
        console.error("Failed to generate shopping list:", err);
        alert("Failed to generate shopping list");
      }
    });
  };

  const tableRows = items.map((item) => ({
    ingredient: item.ingredient,
    quantity: item.quantity,
    unit: item.unit,
  }));

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleGenerate}
          disabled={pending}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: pending ? "not-allowed" : "pointer",
            fontWeight: 500,
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Generating..." : "Generate Shopping List"}
        </button>
        {items.length > 0 && (
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            {items.length} ingredient{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading...</p>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "#9ca3af",
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          No shopping list yet. Generate one based on current orders.
        </div>
      ) : (
        <DataTable
          title="Shopping List"
          columns={[
            { key: "ingredient", label: "Ingredient" },
            { key: "quantity", label: "Quantity", align: "right" },
            { key: "unit", label: "Unit" },
          ]}
          data={tableRows as Record<string, unknown>[]}
        />
      )}
    </div>
  );
}
