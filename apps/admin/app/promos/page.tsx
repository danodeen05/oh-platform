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

const CATEGORIES = ["FOOD", "CONDIMENTS", "MERCHANDISE", "APPAREL", "LIMITED_EDITION"];

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
  targetCategories?: string[];
  targetProductIds?: string[];
  excludedProductIds?: string[];
  locationIds?: string[];
  _count?: { usages: number };
}

interface Product {
  id: string;
  name: string;
  slug: string;
}

interface Location {
  id: string;
  name: string;
}

interface Analytics {
  totalUsages: number;
  totalDiscountGiven: number;
  topCodes: { code: string; usageCount: number; discountGiven: number }[];
  usageByScope: { scope: string; count: number }[];
}

const emptyFormData = {
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
  targetCategories: [] as string[],
  targetProductIds: [] as string[],
  excludedProductIds: [] as string[],
  locationIds: [] as string[],
};

function PromoFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingPromo,
  products,
  locations,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingPromo?: PromoCode | null;
  products: Product[];
  locations: Location[];
}) {
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"basic" | "limits" | "targeting">("basic");
  const [formData, setFormData] = useState(emptyFormData);

  useEffect(() => {
    if (editingPromo) {
      setFormData({
        code: editingPromo.code,
        discountType: editingPromo.discountType,
        discountValue: String(editingPromo.discountValue),
        maxDiscountCents: editingPromo.maxDiscountCents ? String(editingPromo.maxDiscountCents) : "",
        scope: editingPromo.scope,
        totalUsageLimit: editingPromo.totalUsageLimit ? String(editingPromo.totalUsageLimit) : "",
        perUserLimit: String(editingPromo.perUserLimit),
        minimumOrderCents: editingPromo.minimumOrderCents ? String(editingPromo.minimumOrderCents) : "",
        expiresAt: editingPromo.expiresAt ? new Date(editingPromo.expiresAt).toISOString().slice(0, 16) : "",
        description: editingPromo.description || "",
        targetCategories: editingPromo.targetCategories || [],
        targetProductIds: editingPromo.targetProductIds || [],
        excludedProductIds: editingPromo.excludedProductIds || [],
        locationIds: editingPromo.locationIds || [],
      });
    } else {
      setFormData(emptyFormData);
    }
  }, [editingPromo, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const discountValue = parseInt(formData.discountValue, 10);
    if (isNaN(discountValue) || discountValue <= 0) {
      alert("Invalid discount value");
      return;
    }

    startTransition(async () => {
      const body = {
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
        targetCategories: formData.targetCategories.length > 0 ? formData.targetCategories : null,
        targetProductIds: formData.targetProductIds.length > 0 ? formData.targetProductIds : null,
        excludedProductIds: formData.excludedProductIds.length > 0 ? formData.excludedProductIds : null,
        locationIds: formData.locationIds.length > 0 ? formData.locationIds : null,
      };

      const url = editingPromo ? `${BASE}/admin/promo-codes/${editingPromo.id}` : `${BASE}/promo-codes`;
      const method = editingPromo ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to ${editingPromo ? "update" : "create"} promo code`);
        return;
      }

      onSuccess();
      onClose();
    });
  };

  const toggleCategory = (cat: string) => {
    setFormData({
      ...formData,
      targetCategories: formData.targetCategories.includes(cat)
        ? formData.targetCategories.filter((c) => c !== cat)
        : [...formData.targetCategories, cat],
    });
  };

  const toggleProduct = (productId: string, field: "targetProductIds" | "excludedProductIds") => {
    setFormData({
      ...formData,
      [field]: formData[field].includes(productId)
        ? formData[field].filter((id) => id !== productId)
        : [...formData[field], productId],
    });
  };

  const toggleLocation = (locationId: string) => {
    setFormData({
      ...formData,
      locationIds: formData.locationIds.includes(locationId)
        ? formData.locationIds.filter((id) => id !== locationId)
        : [...formData.locationIds, locationId],
    });
  };

  const tabStyle = (tab: string) => ({
    padding: "8px 16px",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #4f46e5" : "2px solid transparent",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#4f46e5" : "#6b7280",
  });

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: 8, width: "90%", maxWidth: 700, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: 0 }}>{editingPromo ? "Edit Promo Code" : "Create Promo Code"}</h3>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #e5e7eb" }}>
          <button style={tabStyle("basic")} onClick={() => setActiveTab("basic")}>Basic Info</button>
          <button style={tabStyle("limits")} onClick={() => setActiveTab("limits")}>Limits</button>
          <button style={tabStyle("targeting")} onClick={() => setActiveTab("targeting")}>Targeting</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: 16 }}>
            {/* Basic Info Tab */}
            {activeTab === "basic" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Code *</label>
                    <input
                      placeholder="e.g., SUMMER20"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                      disabled={!!editingPromo}
                      style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Scope</label>
                    <select value={formData.scope} onChange={(e) => setFormData({ ...formData, scope: e.target.value })} style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #d1d5db" }}>
                      {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Discount Type *</label>
                    <select value={formData.discountType} onChange={(e) => setFormData({ ...formData, discountType: e.target.value })} style={{ padding: 8, width: "100%", borderRadius: 4, border: "1px solid #d1d5db" }}>
                      {DISCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>
                      {formData.discountType === "PERCENTAGE" ? "Percentage (0-100) *" : formData.discountType === "FIXED_AMOUNT" ? "Amount in cents *" : "Value"}
                    </label>
                    <input
                      placeholder={formData.discountType === "PERCENTAGE" ? "e.g., 20" : "e.g., 500"}
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      type="number"
                      required={formData.discountType !== "FREE_SHIPPING"}
                      style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Description (internal)</label>
                  <input
                    placeholder="Internal notes about this promo"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>
            )}

            {/* Limits Tab */}
            {activeTab === "limits" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Total Usage Limit</label>
                    <input
                      placeholder="Unlimited if empty"
                      value={formData.totalUsageLimit}
                      onChange={(e) => setFormData({ ...formData, totalUsageLimit: e.target.value })}
                      type="number"
                      style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Per-User Limit</label>
                    <input
                      placeholder="Default: 1"
                      value={formData.perUserLimit}
                      onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                      type="number"
                      style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Minimum Order (cents)</label>
                    <input
                      placeholder="No minimum if empty"
                      value={formData.minimumOrderCents}
                      onChange={(e) => setFormData({ ...formData, minimumOrderCents: e.target.value })}
                      type="number"
                      style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Max Discount (cents)</label>
                    <input
                      placeholder="Cap for % discounts"
                      value={formData.maxDiscountCents}
                      onChange={(e) => setFormData({ ...formData, maxDiscountCents: e.target.value })}
                      type="number"
                      style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#374151" }}>Expires At</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    style={{ padding: 8, width: "100%", boxSizing: "border-box", borderRadius: 4, border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>
            )}

            {/* Targeting Tab */}
            {activeTab === "targeting" && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 8, color: "#374151", fontWeight: 500 }}>Target Categories</label>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 8 }}>Leave empty to apply to all categories</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          backgroundColor: formData.targetCategories.includes(cat) ? "#4f46e5" : "white",
                          color: formData.targetCategories.includes(cat) ? "white" : "#374151",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 8, color: "#374151", fontWeight: 500 }}>Include Products Only</label>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 8 }}>Leave empty to apply to all products</p>
                  <div style={{ maxHeight: 150, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 4, padding: 8 }}>
                    {products.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>No products available</p>
                    ) : (
                      products.map((product) => (
                        <label key={product.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={formData.targetProductIds.includes(product.id)}
                            onChange={() => toggleProduct(product.id, "targetProductIds")}
                          />
                          <span style={{ fontSize: "0.85rem" }}>{product.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 8, color: "#374151", fontWeight: 500 }}>Exclude Products</label>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 8 }}>Products that should not receive this discount</p>
                  <div style={{ maxHeight: 150, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 4, padding: 8 }}>
                    {products.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>No products available</p>
                    ) : (
                      products.map((product) => (
                        <label key={product.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={formData.excludedProductIds.includes(product.id)}
                            onChange={() => toggleProduct(product.id, "excludedProductIds")}
                          />
                          <span style={{ fontSize: "0.85rem" }}>{product.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 8, color: "#374151", fontWeight: 500 }}>Location Restrictions</label>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 8 }}>Leave empty to apply to all locations</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {locations.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>No locations available</p>
                    ) : (
                      locations.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => toggleLocation(loc.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            backgroundColor: formData.locationIds.includes(loc.id) ? "#4f46e5" : "white",
                            color: formData.locationIds.includes(loc.id) ? "white" : "#374151",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          {loc.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ padding: 16, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={pending} style={{ padding: "8px 16px", backgroundColor: "#4f46e5", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
              {pending ? "Saving..." : editingPromo ? "Update Promo" : "Create Promo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnalyticsSection({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 16 }}>Analytics</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
        <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total Usages</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{analytics.totalUsages}</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#fee2e2", borderRadius: 8, border: "1px solid #fca5a5" }}>
          <div style={{ fontSize: "0.8rem", color: "#991b1b" }}>Total Discount Given</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#991b1b" }}>${(analytics.totalDiscountGiven / 100).toFixed(2)}</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#dbeafe", borderRadius: 8, border: "1px solid #93c5fd" }}>
          <div style={{ fontSize: "0.8rem", color: "#1e40af" }}>Usage by Scope</div>
          <div style={{ fontSize: "0.85rem", marginTop: 4 }}>
            {analytics.usageByScope.map((s) => (
              <div key={s.scope}>{s.scope}: {s.count}</div>
            ))}
          </div>
        </div>
      </div>

      {analytics.topCodes.length > 0 && (
        <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 16, border: "1px solid #e5e7eb" }}>
          <h4 style={{ marginTop: 0 }}>Top Codes</h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Code</th>
                <th style={{ textAlign: "right", padding: 8 }}>Uses</th>
                <th style={{ textAlign: "right", padding: 8 }}>Discount Given</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topCodes.map((code) => (
                <tr key={code.code} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{code.code}</td>
                  <td style={{ textAlign: "right", padding: 8 }}>{code.usageCount}</td>
                  <td style={{ textAlign: "right", padding: 8 }}>${(code.discountGiven / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PromoRow({ promo, onUpdate, onEdit }: { promo: PromoCode; onUpdate: () => void; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  const toggleActive = () => {
    startTransition(async () => {
      await fetch(`${BASE}/admin/promo-codes/${promo.id}`, {
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

  const hasTargeting = (promo.targetCategories && promo.targetCategories.length > 0) ||
    (promo.targetProductIds && promo.targetProductIds.length > 0) ||
    (promo.excludedProductIds && promo.excludedProductIds.length > 0) ||
    (promo.locationIds && promo.locationIds.length > 0);

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
          {hasTargeting && (
            <span style={{ padding: "2px 6px", fontSize: "0.65rem", backgroundColor: "#fef3c7", color: "#92400e", borderRadius: 4 }}>
              Targeted
            </span>
          )}
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
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} style={{ padding: "4px 8px", fontSize: "0.8rem", cursor: "pointer" }}>
            Edit
          </button>
          <button onClick={handleDelete} disabled={pending} style={{ padding: "4px 8px", fontSize: "0.8rem", color: "crimson", cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);

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

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${BASE}/admin/shop/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch(`${BASE}/locations`);
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${BASE}/admin/promo-codes/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  };

  useEffect(() => {
    fetchPromos();
    fetchProducts();
    fetchLocations();
  }, [showInactive]);

  useEffect(() => {
    if (showAnalytics) {
      fetchAnalytics();
    }
  }, [showAnalytics]);

  const handleCreate = () => {
    setEditingPromo(null);
    setModalOpen(true);
  };

  const handleEdit = (promo: PromoCode) => {
    setEditingPromo(promo);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingPromo(null);
  };

  const handleSuccess = () => {
    fetchPromos();
    if (showAnalytics) {
      fetchAnalytics();
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h2>Promo Codes</h2>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Create and manage discount codes for orders.</p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={handleCreate}
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
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive codes
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={showAnalytics} onChange={(e) => setShowAnalytics(e.target.checked)} />
          Show analytics
        </label>
        <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          {promos.length} promo codes
        </span>
      </div>

      {showAnalytics && <AnalyticsSection analytics={analytics} />}

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
              <PromoRow key={promo.id} promo={promo} onUpdate={fetchPromos} onEdit={() => handleEdit(promo)} />
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

      <PromoFormModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editingPromo={editingPromo}
        products={products}
        locations={locations}
      />
    </main>
  );
}
