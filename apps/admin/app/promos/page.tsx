"use client";

import { useState, useEffect, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage Off" },
  { value: "FIXED_AMOUNT", label: "Fixed Amount Off" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
];

const SCOPES = [
  { value: "ALL", label: "All (Universal)" },
  { value: "MENU", label: "Menu Orders Only" },
  { value: "SHOP", label: "Shop Orders Only" },
  { value: "GIFT_CARD", label: "Gift Card Purchases Only" },
];

interface PromoCode {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscountCents?: number;
  scope: string;
  totalUsageLimit?: number;
  perUserLimit: number;
  currentUsageCount: number;
  minimumOrderCents?: number;
  startsAt: string;
  expiresAt?: string;
  isActive: boolean;
  description?: string;
  _count?: { usages: number };
}

function CreatePromoForm({ onSuccess }: { onSuccess: () => void }) {
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    maxDiscountCents: "",
    scope: "ALL",
    totalUsageLimit: "",
    perUserLimit: "1",
    minimumOrderCents: "",
    expiresAt: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const discountValue = parseInt(formData.discountValue, 10);
    if (isNaN(discountValue) || discountValue <= 0) {
      alert("Invalid discount value");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`${BASE}/promo-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          discountType: formData.discountType,
          discountValue,
          maxDiscountCents: formData.maxDiscountCents ? parseInt(formData.maxDiscountCents, 10) : null,
          scope: formData.scope,
          totalUsageLimit: formData.totalUsageLimit ? parseInt(formData.totalUsageLimit, 10) : null,
          perUserLimit: parseInt(formData.perUserLimit, 10) || 1,
          minimumOrderCents: formData.minimumOrderCents ? parseInt(formData.minimumOrderCents, 10) : null,
          expiresAt: formData.expiresAt || null,
          description: formData.description || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create promo code");
        return;
      }
      setFormData({
        code: "", discountType: "PERCENTAGE", discountValue: "", maxDiscountCents: "",
        scope: "ALL", totalUsageLimit: "", perUserLimit: "1", minimumOrderCents: "",
        expiresAt: "", description: "",
      });
      setIsOpen(false);
      onSuccess();
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "10px 20px",
          backgroundColor: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        + Create Promo Code
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16, backgroundColor: "#f9fafb" }}>
      <h3 style={{ marginTop: 0 }}>New Promo Code</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Code *</label>
          <input
            placeholder="e.g., SUMMER20"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            required
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Discount Type *</label>
          <select value={formData.discountType} onChange={(e) => setFormData({ ...formData, discountType: e.target.value })} style={{ padding: 8, width: "100%" }}>
            {DISCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>
            {formData.discountType === "PERCENTAGE" ? "Percentage (0-100) *" : formData.discountType === "FIXED_AMOUNT" ? "Amount in cents *" : "Value (0 for free shipping)"}
          </label>
          <input
            placeholder={formData.discountType === "PERCENTAGE" ? "e.g., 20" : "e.g., 500"}
            value={formData.discountValue}
            onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
            type="number"
            required={formData.discountType !== "FREE_SHIPPING"}
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Scope</label>
          <select value={formData.scope} onChange={(e) => setFormData({ ...formData, scope: e.target.value })} style={{ padding: 8, width: "100%" }}>
            {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Max Discount (cents)</label>
          <input
            placeholder="Cap for % discounts"
            value={formData.maxDiscountCents}
            onChange={(e) => setFormData({ ...formData, maxDiscountCents: e.target.value })}
            type="number"
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Min Order (cents)</label>
          <input
            placeholder="Min order required"
            value={formData.minimumOrderCents}
            onChange={(e) => setFormData({ ...formData, minimumOrderCents: e.target.value })}
            type="number"
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Total Usage Limit</label>
          <input
            placeholder="Unlimited if empty"
            value={formData.totalUsageLimit}
            onChange={(e) => setFormData({ ...formData, totalUsageLimit: e.target.value })}
            type="number"
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Per-User Limit</label>
          <input
            placeholder="Default: 1"
            value={formData.perUserLimit}
            onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
            type="number"
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Expires At</label>
          <input
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4, color: "#4b5563" }}>Description (internal)</label>
        <input
          placeholder="Internal notes about this promo"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ padding: "8px 16px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {pending ? "Creating..." : "Create Promo Code"}
        </button>
        <button type="button" onClick={() => setIsOpen(false)} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PromoRow({ promo, onUpdate }: { promo: PromoCode; onUpdate: () => void }) {
  const [pending, startTransition] = useTransition();

  const toggleActive = () => {
    startTransition(async () => {
      await fetch(`${BASE}/promo-codes/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      onUpdate();
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete promo code "${promo.code}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`${BASE}/promo-codes/${promo.id}`, { method: "DELETE" });
      const data = await res.json();
      alert(data.message);
      onUpdate();
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(promo.code);
    alert(`Copied: ${promo.code}`);
  };

  const formatDiscount = () => {
    if (promo.discountType === "PERCENTAGE") {
      return `${promo.discountValue}%${promo.maxDiscountCents ? ` (max $${(promo.maxDiscountCents / 100).toFixed(2)})` : ""}`;
    } else if (promo.discountType === "FIXED_AMOUNT") {
      return `$${(promo.discountValue / 100).toFixed(2)}`;
    } else {
      return "Free Shipping";
    }
  };

  const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
  const usageText = promo.totalUsageLimit
    ? `${promo.currentUsageCount}/${promo.totalUsageLimit}`
    : `${promo.currentUsageCount}/∞`;

  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb", opacity: promo.isActive ? 1 : 0.6 }}>
      <td style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <code style={{ fontSize: "0.95rem", fontWeight: 600, backgroundColor: "#f3f4f6", padding: "4px 8px", borderRadius: 4 }}>
            {promo.code}
          </code>
          <button onClick={copyCode} style={{ padding: "2px 6px", fontSize: "0.7rem", cursor: "pointer" }} title="Copy">
            Copy
          </button>
        </div>
        {promo.description && (
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4 }}>{promo.description}</div>
        )}
      </td>
      <td style={{ padding: 12 }}>
        <span style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: "0.75rem",
          backgroundColor: promo.discountType === "PERCENTAGE" ? "#dbeafe" : promo.discountType === "FIXED_AMOUNT" ? "#d1fae5" : "#fef3c7",
          color: promo.discountType === "PERCENTAGE" ? "#1e40af" : promo.discountType === "FIXED_AMOUNT" ? "#065f46" : "#92400e",
        }}>
          {promo.discountType.replace("_", " ")}
        </span>
      </td>
      <td style={{ padding: 12, fontWeight: 500 }}>{formatDiscount()}</td>
      <td style={{ padding: 12 }}>
        <span style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: "0.75rem",
          backgroundColor: promo.scope === "ALL" ? "#e0e7ff" : "#f3f4f6",
          color: promo.scope === "ALL" ? "#3730a3" : "#374151",
        }}>
          {promo.scope}
        </span>
      </td>
      <td style={{ padding: 12, textAlign: "center" }}>{usageText}</td>
      <td style={{ padding: 12, textAlign: "center" }}>
        <button
          onClick={toggleActive}
          disabled={pending}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            fontSize: "0.75rem",
            backgroundColor: isExpired ? "#fee2e2" : promo.isActive ? "#d1fae5" : "#f3f4f6",
            color: isExpired ? "#991b1b" : promo.isActive ? "#065f46" : "#6b7280",
          }}
        >
          {isExpired ? "Expired" : promo.isActive ? "Active" : "Inactive"}
        </button>
      </td>
      <td style={{ padding: 12, fontSize: "0.8rem", color: "#6b7280" }}>
        {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString() : "Never"}
      </td>
      <td style={{ padding: 12 }}>
        <button onClick={handleDelete} disabled={pending} style={{ padding: "4px 8px", fontSize: "0.8rem", color: "crimson", cursor: "pointer" }}>
          Delete
        </button>
      </td>
    </tr>
  );
}

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const url = showInactive ? `${BASE}/promo-codes` : `${BASE}/promo-codes?active=true`;
      const res = await fetch(url);
      const data = await res.json();
      setPromos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch promo codes:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPromos();
  }, [showInactive]);

  return (
    <main style={{ padding: 24 }}>
      <h2>Promo Codes</h2>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Create and manage discount codes for orders.</p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <CreatePromoForm onSuccess={fetchPromos} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive codes
        </label>
        <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          {promos.length} promo codes
        </span>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "0.9rem", width: "100%" }}>
          <thead style={{ backgroundColor: "#f9fafb" }}>
            <tr>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Code</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Type</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Discount</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Scope</th>
              <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Usage</th>
              <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Status</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Expires</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((promo) => (
              <PromoRow key={promo.id} promo={promo} onUpdate={fetchPromos} />
            ))}
            {promos.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                  No promo codes yet. Create your first one!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
