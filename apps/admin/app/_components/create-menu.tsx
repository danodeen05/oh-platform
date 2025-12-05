"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

const CATEGORY_TYPES = [
  { value: "MAIN", label: "Main Selection" },
  { value: "SLIDER", label: "Slider/Customization" },
  { value: "ADDON", label: "Add-on" },
  { value: "SIDE", label: "Side Dish" },
  { value: "DRINK", label: "Drink" },
  { value: "DESSERT", label: "Dessert" },
];

const SELECTION_MODES = [
  { value: "SINGLE", label: "Single (radio)" },
  { value: "MULTIPLE", label: "Multiple (checkbox)" },
  { value: "SLIDER", label: "Slider" },
];

export default function CreateMenuForm({
  tenantOptions,
}: {
  tenantOptions: { id: string; brandName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [categoryType, setCategoryType] = useState("");
  const [selectionMode, setSelectionMode] = useState("MULTIPLE");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [description, setDescription] = useState("");
  const [basePriceCents, setBasePriceCents] = useState("");
  const [additionalPriceCents, setAdditionalPriceCents] = useState("0");
  const [includedQuantity, setIncludedQuantity] = useState("0");
  const [tenantId, setTenantId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const basePrice = parseInt(basePriceCents, 10);
    const additionalPrice = parseInt(additionalPriceCents, 10) || 0;
    const included = parseInt(includedQuantity, 10) || 0;
    const order = parseInt(displayOrder, 10) || 0;

    if (Number.isNaN(basePrice)) {
      alert("Base price must be a valid number in cents");
      return;
    }

    await fetch(`${BASE}/menu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "oh"
      },
      body: JSON.stringify({
        name,
        category,
        categoryType: categoryType || null,
        selectionMode,
        displayOrder: order,
        description: description || null,
        basePriceCents: basePrice,
        additionalPriceCents: additionalPrice,
        includedQuantity: included,
        tenantId
      }),
    });

    setName("");
    setCategory("");
    setCategoryType("");
    setSelectionMode("MULTIPLE");
    setDisplayOrder("0");
    setDescription("");
    setBasePriceCents("");
    setAdditionalPriceCents("0");
    setIncludedQuantity("0");
    setTenantId("");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => start(() => onSubmit(e))}
      style={{ display: "grid", gap: 8, maxWidth: 700 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input
          name="name"
          placeholder="Item Name (e.g., Classic Beef Noodle Soup)"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          name="category"
          placeholder="Category (e.g., main01, slider01)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          title="Legacy category string like 'main01', 'slider01', etc."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select
          name="categoryType"
          value={categoryType}
          onChange={(e) => setCategoryType(e.target.value)}
        >
          <option value="">Select Type…</option>
          {CATEGORY_TYPES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          name="selectionMode"
          value={selectionMode}
          onChange={(e) => setSelectionMode(e.target.value)}
        >
          {SELECTION_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>

        <input
          name="displayOrder"
          placeholder="Order (0-99)"
          inputMode="numeric"
          pattern="[0-9]*"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          title="Sort order within category"
        />
      </div>

      <textarea
        name="description"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        style={{ fontFamily: "inherit", padding: "8px" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input
          name="basePriceCents"
          placeholder="Base price (cents)"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={basePriceCents}
          onChange={(e) => setBasePriceCents(e.target.value)}
          title="Base price in cents (e.g., 1499 for $14.99)"
        />
        <input
          name="additionalPriceCents"
          placeholder="Extra price (cents)"
          inputMode="numeric"
          pattern="[0-9]*"
          value={additionalPriceCents}
          onChange={(e) => setAdditionalPriceCents(e.target.value)}
          title="Price for additional servings in cents"
        />
        <input
          name="includedQuantity"
          placeholder="Included qty"
          inputMode="numeric"
          pattern="[0-9]*"
          value={includedQuantity}
          onChange={(e) => setIncludedQuantity(e.target.value)}
          title="Number of servings included (e.g., 1 for baby bok choy)"
        />
      </div>

      <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "-4px" }}>
        Example: Baby Bok Choy with base=$0, extra=$100, included=1 means 1 free, $1 each after
      </div>

      <select
        name="tenantId"
        required
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
      >
        <option value="" disabled>
          Select tenant…
        </option>
        {tenantOptions.map((t) => (
          <option key={t.id} value={t.id}>
            {t.brandName}
          </option>
        ))}
      </select>

      <button type="submit" disabled={pending}>
        Create Menu Item
      </button>
    </form>
  );
}
