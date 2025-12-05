"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SliderControl } from "./slider-control";
import { RadioGroup } from "./radio-group";
import { CheckboxGroup } from "./checkbox-group";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  category?: string;
  categoryType?: string;
  selectionMode?: string;
  description?: string;
  sliderConfig?: any;
  isAvailable: boolean;
};

type MenuSection = {
  id: string;
  name: string;
  description?: string;
  selectionMode: string;
  required: boolean;
  items?: MenuItem[];
  sliderConfig?: any;
  item?: MenuItem;
  maxQuantity?: number;
};

type MenuStep = {
  id: string;
  title: string;
  sections: MenuSection[];
};

type EnhancedMenuBuilderProps = {
  location: any;
  reorderId?: string;
};

export default function EnhancedMenuBuilder({
  location,
  reorderId,
}: EnhancedMenuBuilderProps) {
  const router = useRouter();
  const [menuSteps, setMenuSteps] = useState<MenuStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Cart state: { menuItemId: quantity } for counters, or { menuItemId: sliderValue } for sliders
  const [cart, setCart] = useState<Record<string, number>>({});

  // Selections for single-choice sections (radio groups)
  const [selections, setSelections] = useState<Record<string, string>>({});

  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(reorderId || null);

  // Load menu structure
  useEffect(() => {
    async function loadMenu() {
      try {
        const response = await fetch(`${BASE}/menu/steps`, {
          headers: { "x-tenant-slug": "oh" },
        });
        const data = await response.json();
        setMenuSteps(data.steps);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load menu:", error);
        alert("Failed to load menu. Please try again.");
      }
    }

    loadMenu();
  }, []);

  // If reorderId is provided, load the order
  useEffect(() => {
    if (!reorderId) return;

    async function loadReorder() {
      try {
        const response = await fetch(`${BASE}/orders/${reorderId}`);
        if (!response.ok) throw new Error("Failed to load order");

        const order = await response.json();

        // Populate cart from order items
        const cartData: Record<string, number> = {};
        order.items.forEach((item: any) => {
          cartData[item.menuItem.id] = item.quantity;
        });

        setCart(cartData);
        // Skip to time selection
        setCurrentStepIndex(menuSteps.length);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load reorder:", error);
        alert("Failed to load your previous order.");
        router.push("/member/orders");
      }
    }

    loadReorder();
  }, [reorderId, menuSteps.length]);

  // Calculate price for an item
  function getItemPrice(item: MenuItem, quantity: number): number {
    if (quantity === 0) return 0;

    // For sliders, quantity represents the slider value
    if (item.selectionMode === 'SLIDER') {
      // Check if this is a premium ingredient with additional pricing
      if (quantity <= item.includedQuantity) {
        return 0;
      }
      const extraQuantity = quantity - item.includedQuantity;
      return item.additionalPriceCents * extraQuantity;
    }

    // Standard quantity-based pricing
    if (quantity <= item.includedQuantity) {
      return 0;
    }

    if (item.includedQuantity > 0) {
      const extraQuantity = quantity - item.includedQuantity;
      return item.basePriceCents + item.additionalPriceCents * (extraQuantity - 1);
    }

    // For add-ons with no included quantity: simple multiplication
    return item.basePriceCents * quantity;
  }

  // Get all menu items for price calculation
  function getAllMenuItems(): MenuItem[] {
    const items: MenuItem[] = [];
    menuSteps.forEach(step => {
      step.sections.forEach(section => {
        if (section.items) {
          items.push(...section.items);
        } else if (section.item) {
          items.push(section.item);
        }
      });
    });
    return items;
  }

  // Calculate total with useMemo for proper React reactivity
  const totalCents = useMemo(() => {
    const allItems = getAllMenuItems();
    let total = 0;

    // Add selections (radio groups - SINGLE mode)
    Object.values(selections).forEach(itemId => {
      const item = allItems.find(i => i.id === itemId);
      if (item) {
        total += getItemPrice(item, 1);
      }
    });

    // Add cart items (sliders and checkboxes)
    Object.entries(cart).forEach(([itemId, qty]) => {
      const item = allItems.find(i => i.id === itemId);
      if (item) {
        total += getItemPrice(item, qty);
      }
    });

    return total;
  }, [cart, selections, menuSteps]);

  // Handle radio selection
  function handleRadioSelect(sectionId: string, itemId: string) {
    setSelections(prev => ({ ...prev, [sectionId]: itemId }));
  }

  // Handle quantity update (for checkboxes)
  function handleQuantityUpdate(itemId: string, delta: number) {
    setCart(prev => {
      const current = prev[itemId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
  }

  // Handle slider change
  function handleSliderChange(itemId: string, value: number) {
    setCart(prev => {
      // Keep 0 values in cart to allow "None" selection
      return { ...prev, [itemId]: value };
    });
  }

  // Check if current step is complete
  function isStepComplete(step: MenuStep): boolean {
    return step.sections.every(section => {
      if (!section.required) return true;

      if (section.selectionMode === 'SINGLE') {
        return !!selections[section.id];
      }

      return true; // Sliders and checkboxes are optional
    });
  }

  // Navigate to next step
  function nextStep() {
    const currentStep = menuSteps[currentStepIndex];
    if (!isStepComplete(currentStep)) {
      const requiredSections = currentStep.sections
        .filter(s => s.required && s.selectionMode === 'SINGLE' && !selections[s.id])
        .map(s => s.name);

      if (requiredSections.length > 0) {
        alert(`Please complete: ${requiredSections.join(", ")}`);
        return;
      }
    }

    if (currentStepIndex < menuSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Last menu step, move to time selection
      setCurrentStepIndex(menuSteps.length);
    }
  }

  function previousStep() {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
  }

  async function proceedToPayment() {
    if (!arrivalTime) {
      alert("Please select an arrival time");
      return;
    }

    setSubmitting(true);

    // Calculate estimated arrival
    let estimatedArrival = new Date();
    if (arrivalTime !== "asap") {
      const minutes = parseInt(arrivalTime);
      estimatedArrival = new Date(Date.now() + minutes * 60 * 1000);
    }

    let order;

    if (existingOrderId) {
      const response = await fetch(`${BASE}/orders/${existingOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedArrival: estimatedArrival.toISOString(),
        }),
      });

      if (!response.ok) {
        alert("Failed to update order. Please try again.");
        setSubmitting(false);
        return;
      }

      order = await response.json();
    } else {
      // Build items array from selections and cart
      const items: Array<{ menuItemId: string; quantity: number }> = [];

      // Add radio selections
      Object.values(selections).forEach(itemId => {
        items.push({ menuItemId: itemId, quantity: 1 });
      });

      // Add ALL slider items (with default values if not in cart)
      const customizeStep = menuSteps.find(s => s.id === 'customize');
      if (customizeStep) {
        customizeStep.sections.forEach(section => {
          if (section.item && section.sliderConfig) {
            const itemId = section.item.id;
            const qty = cart[itemId] !== undefined
              ? cart[itemId]
              : (section.sliderConfig.default ?? 0);
            items.push({ menuItemId: itemId, quantity: qty });
          }
        });
      }

      // Add cart items (checkboxes only - sliders already added above)
      Object.entries(cart).forEach(([itemId, qty]) => {
        if (qty > 0) {
          const allItems = getAllMenuItems();
          const item = allItems.find(i => i.id === itemId);
          // Skip sliders - they were already added above
          if (item && item.selectionMode !== 'SLIDER') {
            items.push({ menuItemId: itemId, quantity: qty });
          }
        }
      });

      const response = await fetch(`${BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          tenantId: location.tenantId,
          items,
          estimatedArrival: estimatedArrival.toISOString(),
          fulfillmentType: "PRE_ORDER",
        }),
      });

      order = await response.json();
    }

    setSubmitting(false);

    router.push(
      `/order/payment?orderId=${order.id}&orderNumber=${order.orderNumber}&total=${order.totalCents}`
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🍜</div>
          <div>Loading menu...</div>
        </div>
      </div>
    );
  }

  // Time selection view
  if (currentStepIndex >= menuSteps.length) {
    const timeOptions = [
      { value: "asap", label: "ASAP (15-20 min)", minutes: 15 },
      { value: "30", label: "30 minutes", minutes: 30 },
      { value: "45", label: "45 minutes", minutes: 45 },
      { value: "60", label: "1 hour", minutes: 60 },
      { value: "90", label: "1.5 hours", minutes: 90 },
    ];

    return (
      <div>
        {!existingOrderId && (
          <button
            onClick={previousStep}
            style={{
              marginBottom: 24,
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid #7C7A67",
              color: "#7C7A67",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ← Back to Menu
          </button>
        )}

        <h2 style={{ marginBottom: 24 }}>When will you arrive?</h2>

        <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
          {timeOptions.map((option) => {
            const isSelected = arrivalTime === option.value;
            const estimatedReadyTime = new Date(Date.now() + option.minutes * 60 * 1000);
            const timeStr = estimatedReadyTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <button
                key={option.value}
                onClick={() => setArrivalTime(option.value)}
                style={{
                  border: `2px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: 20,
                  background: isSelected ? "#f0f4ff" : "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: 4 }}>
                      {option.label}
                    </div>
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>
                      Ready by {timeStr}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#7C7A67",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
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

        {/* Order Summary */}
        <div style={{ background: "#f9fafb", padding: 24, borderRadius: 12, marginBottom: 24 }}>
          <h3 style={{ margin: 0, marginBottom: 16 }}>Order Summary</h3>

          {/* Radio selections */}
          {Object.entries(selections).map(([sectionId, itemId]) => {
            const allItems = getAllMenuItems();
            const item = allItems.find(i => i.id === itemId);
            if (!item) return null;

            return (
              <div key={sectionId} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>{item.name}</span>
                <span style={{ color: "#7C7A67" }}>
                  {item.basePriceCents > 0 ? `$${(item.basePriceCents / 100).toFixed(2)}` : "Included"}
                </span>
              </div>
            );
          })}

          {/* Slider items - show ALL sliders with their current values (from cart or default) */}
          {menuSteps.find(s => s.id === 'customize')?.sections.map(section => {
            if (!section.item || !section.sliderConfig) return null;

            const itemId = section.item.id;
            const qty = cart[itemId] !== undefined ? cart[itemId] : (section.sliderConfig.default ?? 0);
            const label = section.sliderConfig.labels?.[qty] || qty;
            const price = getItemPrice(section.item, qty);

            return (
              <div key={itemId} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>{section.item.name}: {label}</span>
                <span style={{ color: "#7C7A67" }}>
                  {price > 0 ? `$${(price / 100).toFixed(2)}` : "Included"}
                </span>
              </div>
            );
          })}

          {/* Checkbox items (add-ons, sides, drinks, desserts) - only show non-zero quantities */}
          {Object.entries(cart).map(([itemId, qty]) => {
            if (qty === 0) return null;

            const allItems = getAllMenuItems();
            const item = allItems.find(i => i.id === itemId);
            if (!item) return null;

            // Skip sliders (already shown above)
            if (item.selectionMode === 'SLIDER') return null;

            const price = getItemPrice(item, qty);
            return (
              <div key={itemId} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>{item.name} (Qty: {qty})</span>
                <span style={{ color: "#7C7A67" }}>
                  {price > 0 ? `$${(price / 100).toFixed(2)}` : "Included"}
                </span>
              </div>
            );
          })}

          <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "1.1rem" }}>
            <span>Total:</span>
            <span style={{ color: "#7C7A67" }}>${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={proceedToPayment}
          disabled={submitting || !arrivalTime}
          style={{
            width: "100%",
            padding: 16,
            background: arrivalTime ? "#7C7A67" : "#d1d5db",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontSize: "1.1rem",
            fontWeight: "bold",
            cursor: arrivalTime && !submitting ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "Processing..." : "Continue to Payment →"}
        </button>
      </div>
    );
  }

  // Menu step rendering
  const currentStep = menuSteps[currentStepIndex];

  return (
    <div>
      {/* Progress indicator */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {menuSteps.map((step, idx) => (
            <div
              key={step.id}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: idx <= currentStepIndex ? "#7C7A67" : "#e5e7eb",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#666" }}>
          <span>Step {currentStepIndex + 1} of {menuSteps.length}</span>
          <span>{currentStep.title}</span>
        </div>
      </div>

      <h2 style={{ marginBottom: 24 }}>{currentStep.title}</h2>

      {/* Render sections */}
      {currentStep.sections.map((section) => {
        if (section.selectionMode === 'SINGLE' && section.items) {
          return (
            <RadioGroup
              key={section.id}
              title={section.name}
              items={section.items}
              selectedId={selections[section.id] || null}
              onSelect={(itemId) => handleRadioSelect(section.id, itemId)}
            />
          );
        }

        if (section.selectionMode === 'SLIDER' && section.item && section.sliderConfig) {
          // Use explicit undefined check to allow 0 values
          const value = cart[section.item.id] !== undefined
            ? cart[section.item.id]
            : (section.sliderConfig.default ?? 0);
          return (
            <div key={section.id} style={{ marginBottom: 16 }}>
              <SliderControl
                name={section.name}
                description={section.description}
                value={value}
                onChange={(val) => handleSliderChange(section.item!.id, val)}
                config={section.sliderConfig}
                pricingInfo={{
                  basePriceCents: section.item.basePriceCents,
                  additionalPriceCents: section.item.additionalPriceCents,
                  includedQuantity: section.item.includedQuantity,
                }}
              />
            </div>
          );
        }

        if (section.selectionMode === 'MULTIPLE' && section.items) {
          return (
            <CheckboxGroup
              key={section.id}
              title={section.name}
              items={section.items}
              quantities={cart}
              onUpdateQuantity={handleQuantityUpdate}
              maxQuantity={section.maxQuantity || 99}
            />
          );
        }

        return null;
      })}

      {/* Navigation */}
      <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "2px solid #e5e7eb", padding: "24px 0", marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <strong style={{ fontSize: "1.1rem" }}>Total:</strong>
          <strong style={{ fontSize: "1.1rem", color: "#7C7A67" }}>
            ${(totalCents / 100).toFixed(2)}
          </strong>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {currentStepIndex > 0 && (
            <button
              onClick={previousStep}
              style={{
                flex: 1,
                padding: 16,
                background: "white",
                color: "#7C7A67",
                border: "2px solid #7C7A67",
                borderRadius: 12,
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={!isStepComplete(currentStep)}
            style={{
              flex: 2,
              padding: 16,
              background: isStepComplete(currentStep) ? "#7C7A67" : "#d1d5db",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: isStepComplete(currentStep) ? "pointer" : "not-allowed",
            }}
          >
            {currentStepIndex === menuSteps.length - 1 ? "Review Order" : "Continue"} →
          </button>
        </div>
      </div>
    </div>
  );
}
