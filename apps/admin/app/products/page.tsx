"use client";

import { useState, useEffect, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const CATEGORIES = ["FOOD", "CONDIMENTS", "MERCHANDISE", "APPAREL", "LIMITED_EDITION"];

interface Product {
  id: string;
  slug: string;
  sku?: string;
  name: string;
  nameZhTW?: string;
  nameZhCN?: string;
  nameEs?: string;
  description?: string;
  priceCents: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
  stockCount?: number;
  lowStockThreshold?: number;
}

function CreateProductForm({ onSuccess }: { onSuccess: () => void }) {
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    slug: "",
    sku: "",
    name: "",
    nameZhTW: "",
    nameZhCN: "",
    nameEs: "",
    description: "",
    priceCents: "",
    category: "MERCHANDISE",
    imageUrl: "",
    stockCount: "",
    lowStockThreshold: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(formData.priceCents, 10);
    if (isNaN(price) || price < 0) {
      alert("Invalid price");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`${BASE}/admin/shop/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          priceCents: price,
          stockCount: formData.stockCount ? parseInt(formData.stockCount, 10) : null,
          lowStockThreshold: formData.lowStockThreshold ? parseInt(formData.lowStockThreshold, 10) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create product");
        return;
      }
      setFormData({
        slug: "", sku: "", name: "", nameZhTW: "", nameZhCN: "", nameEs: "",
        description: "", priceCents: "", category: "MERCHANDISE", imageUrl: "",
        stockCount: "", lowStockThreshold: "",
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
        + Add Product
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16, backgroundColor: "#f9fafb" }}>
      <h3 style={{ marginTop: 0 }}>New Product</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
        <input placeholder="Slug (required)" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} required style={{ padding: 8 }} />
        <input placeholder="SKU" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} style={{ padding: 8 }} />
        <input placeholder="Name (required)" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required style={{ padding: 8 }} />
        <input placeholder="Name (Chinese TW)" value={formData.nameZhTW} onChange={(e) => setFormData({ ...formData, nameZhTW: e.target.value })} style={{ padding: 8 }} />
        <input placeholder="Name (Chinese CN)" value={formData.nameZhCN} onChange={(e) => setFormData({ ...formData, nameZhCN: e.target.value })} style={{ padding: 8 }} />
        <input placeholder="Name (Spanish)" value={formData.nameEs} onChange={(e) => setFormData({ ...formData, nameEs: e.target.value })} style={{ padding: 8 }} />
        <input placeholder="Price in cents (required)" value={formData.priceCents} onChange={(e) => setFormData({ ...formData, priceCents: e.target.value })} type="number" required style={{ padding: 8 }} />
        <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ padding: 8 }}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Image URL" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} style={{ padding: 8 }} />
        <input placeholder="Stock Count (empty = unlimited)" value={formData.stockCount} onChange={(e) => setFormData({ ...formData, stockCount: e.target.value })} type="number" style={{ padding: 8 }} />
        <input placeholder="Low Stock Threshold" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} type="number" style={{ padding: 8 }} />
      </div>
      <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: "100%", padding: 8, marginBottom: 12 }} rows={2} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ padding: "8px 16px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {pending ? "Creating..." : "Create Product"}
        </button>
        <button type="button" onClick={() => setIsOpen(false)} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProductRow({ product, onUpdate }: { product: Product; onUpdate: () => void }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name,
    priceCents: String(product.priceCents),
    stockCount: product.stockCount != null ? String(product.stockCount) : "",
    isAvailable: product.isAvailable,
  });

  const handleSave = () => {
    startTransition(async () => {
      const res = await fetch(`${BASE}/admin/shop/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          priceCents: parseInt(formData.priceCents, 10),
          stockCount: formData.stockCount ? parseInt(formData.stockCount, 10) : null,
          isAvailable: formData.isAvailable,
        }),
      });
      if (res.ok) {
        setEditing(false);
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`${BASE}/admin/shop/products/${product.id}`, { method: "DELETE" });
      const data = await res.json();
      alert(data.message);
      onUpdate();
    });
  };

  const toggleAvailability = () => {
    startTransition(async () => {
      await fetch(`${BASE}/admin/shop/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      });
      onUpdate();
    });
  };

  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: 12 }}>
        {product.imageUrl && (
          <img src={product.imageUrl} alt={product.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
        )}
      </td>
      <td style={{ padding: 12 }}>
        {editing ? (
          <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: 160 }} />
        ) : (
          <div>
            <strong>{product.name}</strong>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{product.slug}</div>
          </div>
        )}
      </td>
      <td style={{ padding: 12, fontFamily: "monospace", fontSize: "0.8rem" }}>{product.sku || "—"}</td>
      <td style={{ padding: 12 }}>
        <span style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: "0.75rem",
          backgroundColor: product.category === "LIMITED_EDITION" ? "#fef3c7" : "#e0e7ff",
          color: product.category === "LIMITED_EDITION" ? "#92400e" : "#3730a3",
        }}>
          {product.category}
        </span>
      </td>
      <td style={{ padding: 12 }}>
        {editing ? (
          <input value={formData.priceCents} onChange={(e) => setFormData({ ...formData, priceCents: e.target.value })} type="number" style={{ width: 80 }} />
        ) : (
          `$${(product.priceCents / 100).toFixed(2)}`
        )}
      </td>
      <td style={{ padding: 12, textAlign: "center" }}>
        {editing ? (
          <input value={formData.stockCount} onChange={(e) => setFormData({ ...formData, stockCount: e.target.value })} type="number" style={{ width: 60 }} placeholder="∞" />
        ) : (
          product.stockCount != null ? product.stockCount : "∞"
        )}
      </td>
      <td style={{ padding: 12, textAlign: "center" }}>
        <button
          onClick={toggleAvailability}
          disabled={pending}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            fontSize: "0.75rem",
            backgroundColor: product.isAvailable ? "#d1fae5" : "#fee2e2",
            color: product.isAvailable ? "#065f46" : "#991b1b",
          }}
        >
          {product.isAvailable ? "Available" : "Unavailable"}
        </button>
      </td>
      <td style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {editing ? (
            <>
              <button onClick={handleSave} disabled={pending} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Edit</button>
              <button onClick={handleDelete} disabled={pending} style={{ padding: "4px 8px", fontSize: "0.8rem", color: "crimson" }}>Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = filter ? `${BASE}/admin/shop/products?category=${filter}` : `${BASE}/admin/shop/products`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [filter]);

  return (
    <main style={{ padding: 24 }}>
      <h2>Shop Products</h2>
      <p style={{ color: "#6b7280", marginBottom: 16 }}>Manage e-commerce products displayed on the shop page.</p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <CreateProductForm onSuccess={fetchProducts} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: 8 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          {products.length} products
        </span>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "0.9rem", width: "100%" }}>
          <thead style={{ backgroundColor: "#f9fafb" }}>
            <tr>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb", width: 60 }}>Image</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Name</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>SKU</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Category</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Price</th>
              <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Stock</th>
              <th style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Status</th>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ProductRow key={product.id} product={product} onUpdate={fetchProducts} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
