"use client";

import { useState, useEffect, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Denomination {
  id: string;
  amountCents: number;
  displayOrder: number;
  isActive: boolean;
}

interface CustomRange {
  id: string;
  minAmountCents: number;
  maxAmountCents: number;
}

interface Design {
  id: string;
  designId: string;
  designName: string;
  gradient: string;
  displayOrder: number;
  isActive: boolean;
}

function DenominationSection({
  denominations,
  customRange,
  onUpdate,
}: {
  denominations: Denomination[];
  customRange: CustomRange | null;
  onUpdate: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [newAmount, setNewAmount] = useState("");
  const [minAmount, setMinAmount] = useState(customRange?.minAmountCents?.toString() || "1000");
  const [maxAmount, setMaxAmount] = useState(customRange?.maxAmountCents?.toString() || "50000");

  const addDenomination = () => {
    const cents = parseInt(newAmount, 10);
    if (isNaN(cents) || cents <= 0) {
      alert("Invalid amount");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`${BASE}/admin/gift-card-config/denominations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, displayOrder: denominations.length }),
      });
      if (res.ok) {
        setNewAmount("");
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add");
      }
    });
  };

  const removeDenomination = (id: string) => {
    startTransition(async () => {
      await fetch(`${BASE}/admin/gift-card-config/denominations/${id}`, { method: "DELETE" });
      onUpdate();
    });
  };

  const updateCustomRange = () => {
    const min = parseInt(minAmount, 10);
    const max = parseInt(maxAmount, 10);
    if (isNaN(min) || isNaN(max) || min < 0 || max <= min) {
      alert("Invalid range");
      return;
    }
    startTransition(async () => {
      await fetch(`${BASE}/admin/gift-card-config/custom-range`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minAmountCents: min, maxAmountCents: max }),
      });
      onUpdate();
    });
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h3>Preset Denominations</h3>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 16 }}>
        These are the quick-select amounts shown on the gift card purchase page.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {denominations.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              backgroundColor: "#f3f4f6",
              borderRadius: 8,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>${(d.amountCents / 100).toFixed(0)}</span>
            <button
              onClick={() => removeDenomination(d.id)}
              disabled={pending}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem" }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}>
        <input
          type="number"
          placeholder="Amount in cents (e.g., 5000 = $50)"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          style={{ padding: 8, width: 280 }}
        />
        <button
          onClick={addDenomination}
          disabled={pending}
          style={{ padding: "8px 16px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          Add Denomination
        </button>
      </div>

      <h4>Custom Amount Range</h4>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 12 }}>
        Min and max for custom amounts (in cents).
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>$</span>
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          style={{ padding: 8, width: 100 }}
        />
        <span>to $</span>
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          style={{ padding: 8, width: 100 }}
        />
        <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>(in cents)</span>
        <button
          onClick={updateCustomRange}
          disabled={pending}
          style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}
        >
          Update Range
        </button>
      </div>
    </div>
  );
}

function DesignSection({ designs, onUpdate }: { designs: Design[]; onUpdate: () => void }) {
  const [pending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [newDesign, setNewDesign] = useState({ designId: "", designName: "", gradient: "" });

  const addDesign = () => {
    if (!newDesign.designId || !newDesign.designName || !newDesign.gradient) {
      alert("All fields required");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`${BASE}/admin/gift-card-config/designs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newDesign, displayOrder: designs.length }),
      });
      if (res.ok) {
        setNewDesign({ designId: "", designName: "", gradient: "" });
        setIsAdding(false);
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add");
      }
    });
  };

  const removeDesign = (id: string) => {
    if (!confirm("Delete this design?")) return;
    startTransition(async () => {
      await fetch(`${BASE}/admin/gift-card-config/designs/${id}`, { method: "DELETE" });
      onUpdate();
    });
  };

  const toggleDesign = (id: string, isActive: boolean) => {
    startTransition(async () => {
      await fetch(`${BASE}/admin/gift-card-config/designs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      onUpdate();
    });
  };

  return (
    <div>
      <h3>Gift Card Designs</h3>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 16 }}>
        Visual designs users can choose when purchasing gift cards.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {designs.map((d) => (
          <div
            key={d.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              opacity: d.isActive ? 1 : 0.5,
            }}
          >
            <div
              style={{
                height: 100,
                background: d.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 600,
                fontSize: "1.2rem",
              }}
            >
              Gift Card
            </div>
            <div style={{ padding: 12, backgroundColor: "white" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.designName}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 8, fontFamily: "monospace" }}>{d.designId}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => toggleDesign(d.id, d.isActive)}
                  disabled={pending}
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: d.isActive ? "#d1fae5" : "#fee2e2",
                    color: d.isActive ? "#065f46" : "#991b1b",
                  }}
                >
                  {d.isActive ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => removeDesign(d.id)}
                  disabled={pending}
                  style={{ padding: "4px 8px", fontSize: "0.75rem", color: "crimson", cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAdding ? (
        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, backgroundColor: "#f9fafb" }}>
          <h4 style={{ marginTop: 0 }}>Add New Design</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
            <input
              placeholder="Design ID (e.g., festive)"
              value={newDesign.designId}
              onChange={(e) => setNewDesign({ ...newDesign, designId: e.target.value.toLowerCase().replace(/\s/g, "-") })}
              style={{ padding: 8 }}
            />
            <input
              placeholder="Display Name (e.g., Festive)"
              value={newDesign.designName}
              onChange={(e) => setNewDesign({ ...newDesign, designName: e.target.value })}
              style={{ padding: 8 }}
            />
            <input
              placeholder="CSS Gradient"
              value={newDesign.gradient}
              onChange={(e) => setNewDesign({ ...newDesign, gradient: e.target.value })}
              style={{ padding: 8 }}
            />
          </div>
          {newDesign.gradient && (
            <div style={{ height: 60, background: newDesign.gradient, borderRadius: 8, marginBottom: 12 }} />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={addDesign}
              disabled={pending}
              style={{ padding: "8px 16px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              Add Design
            </button>
            <button
              onClick={() => setIsAdding(false)}
              style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          + Add Design
        </button>
      )}
    </div>
  );
}

export default function GiftCardConfigPage() {
  const [denominations, setDenominations] = useState<Denomination[]>([]);
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/gift-card-config`);
      const data = await res.json();
      setDenominations(data.denominations || []);
      setCustomRange(data.customRange || null);
      setDesigns(data.designs || []);
    } catch (err) {
      console.error("Failed to fetch gift card config:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Gift Card Configuration</h2>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>Gift Card Configuration</h2>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Manage gift card denominations and designs shown on the purchase page.
      </p>

      <DenominationSection denominations={denominations} customRange={customRange} onUpdate={fetchConfig} />
      <DesignSection designs={designs} onUpdate={fetchConfig} />
    </main>
  );
}
