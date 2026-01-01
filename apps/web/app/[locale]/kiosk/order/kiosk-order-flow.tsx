"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { pdf } from "@react-pdf/renderer";
import { VirtualKeyboard, PrintableReceipt, generateQRDataUrl, LanguageSelector } from "@/components/kiosk";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Consistent kiosk color system
const COLORS = {
  primary: "#7C7A67",
  primaryDark: "#5A5847", // Darker olive for slider thumb
  primaryLight: "rgba(124, 122, 103, 0.15)",
  primaryBorder: "rgba(124, 122, 103, 0.4)",
  surface: "#FFFFFF",
  surfaceElevated: "#FAFAFA",
  surfaceDark: "#1a1a1a",
  text: "#1a1a1a",
  textLight: "#666666",
  textMuted: "#999999",
  textOnPrimary: "#FFFFFF",
  textOnDark: "#FFFFFF",
  success: "#22c55e",
  successLight: "rgba(34, 197, 94, 0.1)",
  warning: "#f59e0b",
  warningLight: "rgba(245, 158, 11, 0.1)",
  error: "#ef4444",
  border: "#e5e5e5",
  borderDark: "#333333",
};

// CSS for custom slider thumb styling
const sliderThumbStyles = `
  input[type="range"].kiosk-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type="range"].kiosk-slider::-webkit-slider-runnable-track {
    height: 10px;
    background: #e5e5e5;
    border-radius: 5px;
  }

  input[type="range"].kiosk-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 36px;
    height: 36px;
    background: #5A5847;
    border-radius: 50%;
    margin-top: -13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: 3px solid #FFFFFF;
  }

  input[type="range"].kiosk-slider::-moz-range-track {
    height: 10px;
    background: #e5e5e5;
    border-radius: 5px;
  }

  input[type="range"].kiosk-slider::-moz-range-thumb {
    width: 30px;
    height: 30px;
    background: #5A5847;
    border-radius: 50%;
    border: 3px solid #FFFFFF;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
`;

// Brand component for consistent branding across all kiosk screens
function KioskBrand({ size = "normal" }: { size?: "small" | "normal" | "large" | "xlarge" }) {
  const tHome = useTranslations("home");
  const sizes = {
    small: { logo: 32, chinese: "1.2rem", english: "0.65rem", gap: 4 },
    normal: { logo: 48, chinese: "1.8rem", english: "0.95rem", gap: 6 },
    large: { logo: 96, chinese: "3.5rem", english: "1.8rem", gap: 10 },
    xlarge: { logo: 160, chinese: "5.6rem", english: "2.8rem", gap: 12 },
  };
  const s = sizes[size];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: s.gap }}>
      <img
        src="/Oh_Logo_Large.png"
        alt="Oh! Logo"
        style={{ width: s.logo, height: s.logo, objectFit: "contain" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: s.english, lineHeight: 1 }}>
        {tHome.rich("brandName", {
          oh: () => (
            <span
              style={{
                fontFamily: '"Ma Shan Zheng", cursive',
                fontSize: s.chinese,
                color: "#C7A878",
              }}
            >
              哦
            </span>
          ),
          bebas: (chunks) => (
            <span
              style={{
                fontFamily: '"Bebas Neue", sans-serif',
                color: COLORS.text,
                letterSpacing: "0.02em",
              }}
            >
              {chunks}
            </span>
          ),
        })}
      </div>
    </div>
  );
}

// Dietary badges component for displaying V/VG/GF/Spicy indicators
function DietaryBadges({
  isVegetarian,
  isVegan,
  isGlutenFree,
  spiceLevel,
  size = "normal",
}: {
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number;
  size?: "small" | "normal" | "large";
}) {
  const sizes = {
    small: { badge: 18, gap: 3, spiceFont: "0.6rem", spicePadding: "1px 4px" },
    normal: { badge: 24, gap: 4, spiceFont: "0.7rem", spicePadding: "2px 6px" },
    large: { badge: 32, gap: 6, spiceFont: "0.85rem", spicePadding: "3px 8px" },
  };
  const s = sizes[size];

  const badges: { label: string; src: string }[] = [];

  if (isVegan) {
    badges.push({ label: "Vegan", src: "/allergens/vegan.png" });
  } else if (isVegetarian) {
    badges.push({ label: "Vegetarian", src: "/allergens/vegetarian.png" });
  }

  if (isGlutenFree) {
    badges.push({ label: "Gluten-Free", src: "/allergens/gluten-free.png" });
  }

  const hasDietaryInfo = badges.length > 0 || (spiceLevel && spiceLevel > 0);
  if (!hasDietaryInfo) return null;

  return (
    <div style={{ display: "flex", gap: s.gap, flexWrap: "wrap", alignItems: "center" }}>
      {badges.map((badge, idx) => (
        <img
          key={idx}
          src={badge.src}
          alt={badge.label}
          title={badge.label}
          style={{ width: s.badge, height: s.badge, objectFit: "contain" }}
        />
      ))}
      {spiceLevel !== undefined && spiceLevel > 0 && (
        <span
          title={spiceLevel >= 3 ? "Hot" : spiceLevel >= 2 ? "Medium" : "Mild"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "1px",
            padding: s.spicePadding,
            fontSize: s.spiceFont,
            fontWeight: 600,
            borderRadius: 4,
            background: spiceLevel >= 3 ? "#fef2f2" : spiceLevel >= 2 ? "#fff7ed" : "#fefce8",
            color: spiceLevel >= 3 ? "#dc2626" : spiceLevel >= 2 ? "#ea580c" : "#ca8a04",
          }}
        >
          {Array.from({ length: spiceLevel }).map((_, i) => (
            <span key={i}>🌶️</span>
          ))}
        </span>
      )}
    </div>
  );
}

// Menu item image mapping - using correct file names from /public/menu images/
// Keys match exact API names from /menu/steps endpoint (includes English, zh-TW, zh-CN)
const MENU_IMAGES: Record<string, string> = {
  // Bowls - English
  "A5 Wagyu Beef Noodle Soup": "/menu images/A5 Wagyu Bowl.png",
  "Classic Beef Noodle Soup": "/menu images/Classic Bowl.png",
  "Classic Beef Noodle Soup (no beef)": "/menu images/Classic Bowl No Beef.png",
  // Bowls - Chinese Traditional (zh-TW)
  "A5和牛牛肉麵": "/menu images/A5 Wagyu Bowl.png",
  "經典牛肉麵": "/menu images/Classic Bowl.png",
  "經典牛肉麵（無牛肉）": "/menu images/Classic Bowl No Beef.png",
  // Bowls - Chinese Simplified (zh-CN)
  "A5和牛牛肉面": "/menu images/A5 Wagyu Bowl.png",
  "经典牛肉面": "/menu images/Classic Bowl.png",
  "经典牛肉面（无牛肉）": "/menu images/Classic Bowl No Beef.png",
  // Legacy/alternate names
  "A5 Wagyu Noodle Soup": "/menu images/A5 Wagyu Bowl.png",
  "Classic Beef Noodle Soup (No Beef)": "/menu images/Classic Bowl No Beef.png",
  "Classic Bowl": "/menu images/Classic Bowl.png",
  "Classic Bowl (No Beef)": "/menu images/Classic Bowl No Beef.png",
  "A5 Wagyu Bowl": "/menu images/A5 Wagyu Bowl.png",
  // Noodles - English
  "Ramen Noodles": "/menu images/Ramen Noodles.png",
  "Shaved Noodles": "/menu images/Shaved Noodles.png",
  "Wide Noodles": "/menu images/Wide Noodles.png",
  "Wide Noodles (Gluten Free)": "/menu images/Wide Noodles.png",
  // "No Noodles" items should NOT have images - they render as buttons
  // Noodles - Chinese Traditional (zh-TW)
  "拉麵": "/menu images/Ramen Noodles.png",
  "刀削麵": "/menu images/Shaved Noodles.png",
  "寬麵": "/menu images/Wide Noodles.png",
  "寬麵（無麩質）": "/menu images/Wide Noodles.png",
  // Noodles - Chinese Simplified (zh-CN)
  "拉面": "/menu images/Ramen Noodles.png",
  "刀削面": "/menu images/Shaved Noodles.png",
  "宽面": "/menu images/Wide Noodles.png",
  "宽面（无麸质）": "/menu images/Wide Noodles.png",
  // Noodles - Spanish (es)
  "Fideos Ramen": "/menu images/Ramen Noodles.png",
  "Fideos Cortados": "/menu images/Shaved Noodles.png",
  "Fideos Anchos": "/menu images/Wide Noodles.png",
  "Fideos Anchos (Sin Gluten)": "/menu images/Wide Noodles.png",
  // Toppings & Add-Ons - English
  "Baby Bok Choy": "/menu images/Baby Bok Choy.png",
  "Beef Marrow": "/menu images/Beef Marrow.png",
  "Bone Marrow": "/menu images/Beef Marrow.png",
  "Cilantro": "/menu images/Cilantro.png",
  "Extra Beef": "/menu images/Extra Beef.png",
  "Extra Noodles": "/menu images/Wide Noodles.png",
  "Green Onions": "/menu images/Green Onions.png",
  "Pickled Greens": "/menu images/Pickled Greens.png",
  "Sprouts": "/menu images/Sprouts.png",
  // Toppings & Add-Ons - Chinese (shared zh-TW/zh-CN where identical)
  "青江菜": "/menu images/Baby Bok Choy.png",
  "牛骨髓": "/menu images/Beef Marrow.png",
  "香菜": "/menu images/Cilantro.png",
  "加牛肉": "/menu images/Extra Beef.png",
  "酸菜": "/menu images/Pickled Greens.png",
  "豆芽菜": "/menu images/Sprouts.png",
  // Toppings - Chinese Traditional (zh-TW) specific
  "加麵": "/menu images/Wide Noodles.png",
  "蔥花": "/menu images/Green Onions.png",
  // Toppings - Chinese Simplified (zh-CN) specific
  "加面": "/menu images/Wide Noodles.png",
  "葱花": "/menu images/Green Onions.png",
  // Toppings & Add-Ons - Spanish (es)
  "Bok Choy Pequeño": "/menu images/Baby Bok Choy.png",
  "Tuétano de Res": "/menu images/Beef Marrow.png",
  "Tuétano": "/menu images/Beef Marrow.png",
  "Carne Extra": "/menu images/Extra Beef.png",
  "Fideos Extra": "/menu images/Wide Noodles.png",
  "Cebollín": "/menu images/Green Onions.png",
  "Cebollines": "/menu images/Green Onions.png",
  "Verduras Encurtidas": "/menu images/Pickled Greens.png",
  "Germinados": "/menu images/Sprouts.png",
  "Brotes": "/menu images/Sprouts.png",
  "Brotes de Soja": "/menu images/Sprouts.png",
  // Egg variants - English (API has typo "Soft-Boild Egg")
  "Soft-Boild Egg": "/menu images/Soft Boiled Egg.png",
  "Soft-Boiled Egg": "/menu images/Soft Boiled Egg.png",
  "Soft Boiled Egg": "/menu images/Soft Boiled Egg.png",
  // Egg - Chinese Traditional & Simplified
  "溏心蛋": "/menu images/Soft Boiled Egg.png",
  "糖心蛋": "/menu images/Soft Boiled Egg.png",
  "半熟蛋": "/menu images/Soft Boiled Egg.png",
  "溫泉蛋": "/menu images/Soft Boiled Egg.png",
  "温泉蛋": "/menu images/Soft Boiled Egg.png",
  "水煮蛋": "/menu images/Soft Boiled Egg.png",
  // Egg - Spanish
  "Huevo Cocido": "/menu images/Soft Boiled Egg.png",
  "Huevo Tibio": "/menu images/Soft Boiled Egg.png",
  "Huevo Pasado por Agua": "/menu images/Soft Boiled Egg.png",
  // Sides - English
  "Spicy Cucumbers": "/menu images/Spicy Cucumbers.png",
  "Spicy Green Beans": "/menu images/Spicy Green Beans.png",
  // Sides - Chinese Traditional (zh-TW)
  "涼拌小黃瓜": "/menu images/Spicy Cucumbers.png",
  "乾煸四季豆": "/menu images/Spicy Green Beans.png",
  // Sides - Chinese Simplified (zh-CN)
  "凉拌小黄瓜": "/menu images/Spicy Cucumbers.png",
  "干煸四季豆": "/menu images/Spicy Green Beans.png",
  // Sides - Spanish (es)
  "Pepinos Picantes": "/menu images/Spicy Cucumbers.png",
  "Ejotes Picantes": "/menu images/Spicy Green Beans.png",
  // Desserts - English
  "Mandarin Orange Sherbet": "/menu images/Mandarin Orange Sherbet.png",
  // Desserts - Chinese (same for zh-TW & zh-CN)
  "橘子雪酪": "/menu images/Mandarin Orange Sherbet.png",
  // Desserts - Spanish (es)
  "Sorbete de Mandarina": "/menu images/Mandarin Orange Sherbet.png",
  // Beverages - English
  "Pepsi": "/menu images/Pepsi.jpg",
  "Diet Pepsi": "/menu images/DietPepsi.jpg",
  "Water (cold)": "/menu images/IceWater.jpeg",
  "Water (room temp)": "/menu images/RoomTempWater.jpeg",
  // Beverages - Chinese (shared zh-TW/zh-CN)
  "冰水": "/menu images/IceWater.jpeg",
  // Beverages - Chinese Traditional (zh-TW)
  "百事可樂": "/menu images/Pepsi.jpg",
  "無糖百事": "/menu images/DietPepsi.jpg",
  "常溫水": "/menu images/RoomTempWater.jpeg",
  // Beverages - Chinese Simplified (zh-CN)
  "百事可乐": "/menu images/Pepsi.jpg",
  "无糖百事": "/menu images/DietPepsi.jpg",
  "常温水": "/menu images/RoomTempWater.jpeg",
  // Beverages - Spanish (es)
  "Pepsi Light": "/menu images/DietPepsi.jpg",
  "Agua (fría)": "/menu images/IceWater.jpeg",
  "Agua (ambiente)": "/menu images/RoomTempWater.jpeg",
  "Agua Fría": "/menu images/IceWater.jpeg",
  "Agua Ambiente": "/menu images/RoomTempWater.jpeg",
};

type Location = {
  id: string;
  name: string;
  tenantId: string;
  taxRate: number;
};

type Seat = {
  id: string;
  number: string;
  status: string;
  podType: "SINGLE" | "DUAL";
  row: number;
  col: number;
  side: string;
  dualPartnerId?: string;
};

type MenuItem = {
  id: string;
  name: string;
  nameEn?: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  category?: string;
  selectionMode?: string;
  sliderConfig?: any;
  isAvailable: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number;
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

type GuestOrder = {
  guestNumber: number;
  guestName: string;
  cart: Record<string, number>;
  sliderLabels: Record<string, string>;
  selections: Record<string, string>;
  orderId?: string;
  orderNumber?: string;
  orderQrCode?: string;
  dailyOrderNumber?: number;
  subtotalCents?: number;
  taxCents?: number;
  totalCents?: number;
  paid: boolean;
  selectedPodId?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
};

// Helper to calculate item price
function calculateItemPrice(item: MenuItem, quantity: number): number {
  if (quantity <= 0) return 0;
  if (quantity <= item.includedQuantity) return 0;

  // If additionalPriceCents is 0, use basePriceCents for each item
  const effectiveAdditionalPrice = item.additionalPriceCents || item.basePriceCents;

  if (item.includedQuantity > 0) {
    const extraQuantity = quantity - item.includedQuantity;
    return item.basePriceCents + effectiveAdditionalPrice * (extraQuantity - 1);
  }
  return item.basePriceCents + effectiveAdditionalPrice * (quantity - 1);
}

export default function KioskOrderFlow({
  location,
  partySize,
  paymentType,
}: {
  location: Location;
  partySize: number;
  paymentType: "single" | "separate";
}) {
  const router = useRouter();
  const t = useTranslations("order");
  const tKiosk = useTranslations("kiosk");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [menuSteps, setMenuSteps] = useState<MenuStep[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track all guest orders
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>(
    Array.from({ length: partySize }, (_, i) => ({
      guestNumber: i + 1,
      guestName: "",
      cart: {},
      sliderLabels: {},
      selections: {},
      paid: false,
    }))
  );

  // Current guest being served
  const [currentGuestIndex, setCurrentGuestIndex] = useState(0);

  // Current step in menu flow for current guest
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Current view
  const [view, setView] = useState<
    "name" | "menu" | "review" | "pod-selection" | "pass" | "payment" | "complete"
  >("name");

  // Scroll to top when view or step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view, currentStepIndex, currentGuestIndex]);

  // Processing state
  const [submitting, setSubmitting] = useState(false);

  // Current guest's working state
  const currentGuest = guestOrders[currentGuestIndex];

  // Load menu structure and seats
  useEffect(() => {
    async function loadData() {
      try {
        const [menuRes, seatsRes] = await Promise.all([
          fetch(`${BASE}/menu/steps?locale=${locale}`, {
            headers: { "x-tenant-slug": "oh" },
          }),
          fetch(`${BASE}/locations/${location.id}/seats`, {
            headers: { "x-tenant-slug": "oh" },
          }),
        ]);

        const menuData = await menuRes.json();
        setMenuSteps(menuData.steps);

        if (seatsRes.ok) {
          const seatsData = await seatsRes.json();
          setSeats(seatsData);
        }

        // Initialize cart with slider defaults for first guest
        const initialCart: Record<string, number> = {};
        const initialLabels: Record<string, string> = {};
        menuData.steps.forEach((step: MenuStep) => {
          step.sections.forEach((section: MenuSection) => {
            if (section.selectionMode === "SLIDER" && section.item && section.sliderConfig) {
              const defaultValue = section.sliderConfig.default ?? 0;
              initialCart[section.item.id] = defaultValue;
              const labels = section.sliderConfig.labels || [];
              initialLabels[section.item.id] = labels[defaultValue] || String(defaultValue);
            }
          });
        });

        // Update all guests with initial cart
        setGuestOrders((prev) =>
          prev.map((g) => ({
            ...g,
            cart: { ...initialCart },
            sliderLabels: { ...initialLabels },
          }))
        );

        setLoading(false);
      } catch (error) {
        console.error("Failed to load menu:", error);
        setErrorMessage("Failed to load menu. Please try again.");
      }
    }

    loadData();
  }, [location.id, locale]);

  // Calculate running total for current guest
  const calculateRunningTotal = useCallback(() => {
    let total = 0;

    // Add selections (SINGLE mode items - bowls)
    Object.entries(currentGuest.selections).forEach(([sectionId, itemId]) => {
      menuSteps.forEach((step) => {
        step.sections.forEach((section) => {
          if (section.id === sectionId && section.items) {
            const item = section.items.find((i) => i.id === itemId);
            if (item) {
              total += item.basePriceCents;
            }
          }
        });
      });
    });

    // Add cart items (MULTIPLE mode and SLIDER mode)
    Object.entries(currentGuest.cart).forEach(([itemId, qty]) => {
      menuSteps.forEach((step) => {
        step.sections.forEach((section) => {
          if (section.selectionMode === "MULTIPLE" && section.items) {
            const item = section.items.find((i) => i.id === itemId);
            if (item && qty > 0) {
              total += calculateItemPrice(item, qty);
            }
          } else if (section.selectionMode === "SLIDER" && section.item?.id === itemId) {
            // Sliders typically don't add extra cost unless configured
          }
        });
      });
    });

    return total;
  }, [currentGuest.selections, currentGuest.cart, menuSteps]);

  function updateCurrentGuest(updates: Partial<GuestOrder>) {
    setGuestOrders((prev) =>
      prev.map((g, i) => (i === currentGuestIndex ? { ...g, ...updates } : g))
    );
  }

  function handleNameSubmit(name: string) {
    updateCurrentGuest({ guestName: name });
    setView("menu");
  }

  function handleCartUpdate(itemId: string, quantity: number, maxQuantity?: number) {
    const finalQty = maxQuantity !== undefined ? Math.min(quantity, maxQuantity) : quantity;
    updateCurrentGuest({
      cart: { ...currentGuest.cart, [itemId]: finalQty },
    });
  }

  function handleSliderUpdate(itemId: string, value: number, label: string) {
    updateCurrentGuest({
      cart: { ...currentGuest.cart, [itemId]: value },
      sliderLabels: { ...currentGuest.sliderLabels, [itemId]: label },
    });
  }

  function handleSelectionUpdate(sectionId: string, itemId: string) {
    updateCurrentGuest({
      selections: { ...currentGuest.selections, [sectionId]: itemId },
    });
  }

  function nextStep() {
    if (currentStepIndex < menuSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setView("review");
    }
  }

  function previousStep() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  function handlePodSelection(podId: string) {
    updateCurrentGuest({ selectedPodId: podId });
  }

  // Helper to check if a seat is a dual pod
  function isDualPodSeat(seatId: string): boolean {
    const seat = seats.find(s => s.id === seatId);
    if (!seat) return false;
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return true;
    return seats.some(s => s.dualPartnerId === seat.id);
  }

  function handlePodConfirm() {
    const currentPodId = guestOrders[currentGuestIndex]?.selectedPodId;

    if (paymentType === "single" && currentGuestIndex < partySize - 1) {
      // Check if current guest selected a dual pod
      if (currentPodId && isDualPodSeat(currentPodId)) {
        // Dual pod selected - auto-assign remaining guests (up to 1 more for dual pod)
        // and skip their pod selection
        const nextGuestIndex = currentGuestIndex + 1;

        // Assign the same dual pod to the next guest
        setGuestOrders(prev => {
          const updated = [...prev];
          if (updated[nextGuestIndex]) {
            updated[nextGuestIndex] = {
              ...updated[nextGuestIndex],
              selectedPodId: currentPodId,
            };
          }
          return updated;
        });

        // If there are only 2 guests total, go straight to payment
        // If more than 2 guests, continue pod selection for remaining guests
        if (partySize === 2) {
          setView("payment");
        } else {
          // Skip the next guest (already assigned) and continue with guest after that
          setCurrentGuestIndex(nextGuestIndex + 1);
          if (nextGuestIndex + 1 >= partySize) {
            setView("payment");
          }
        }
      } else {
        // Single pod selected - continue to next guest's pod selection
        setCurrentGuestIndex((prev) => prev + 1);
      }
    } else {
      // Move to payment after all pod selections
      setView("payment");
    }
  }

  async function submitCurrentGuestOrder() {
    setSubmitting(true);

    // Build items array
    const items: Array<{ menuItemId: string; quantity: number; selectedValue?: string }> = [];

    // Add radio selections
    Object.values(currentGuest.selections).forEach((itemId) => {
      items.push({ menuItemId: itemId, quantity: 1 });
    });

    // Add cart items
    Object.entries(currentGuest.cart).forEach(([itemId, qty]) => {
      const isSliderItem = itemId in currentGuest.sliderLabels;
      if (isSliderItem || qty > 0) {
        const selectedValue = currentGuest.sliderLabels[itemId];
        items.push({ menuItemId: itemId, quantity: qty, selectedValue });
      }
    });

    try {
      const response = await fetch(`${BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          tenantId: location.tenantId,
          items,
          estimatedArrival: new Date().toISOString(),
          fulfillmentType: "WALK_IN",
          guestName: currentGuest.guestName,
          isKioskOrder: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      const order = await response.json();

      // Calculate tax from the order subtotal
      const subtotalCents = order.totalCents; // Backend returns pre-tax total
      const taxCents = Math.round(subtotalCents * location.taxRate);
      const totalWithTaxCents = subtotalCents + taxCents;

      // Update guest with order info - use kitchenOrderNumber from API
      updateCurrentGuest({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderQrCode: order.orderQrCode,
        dailyOrderNumber: order.kitchenOrderNumber,
        subtotalCents,
        taxCents,
        totalCents: totalWithTaxCents,
      });

      setSubmitting(false);

      // Determine next view based on payment type and remaining guests
      if (paymentType === "single") {
        // Single payment: collect all orders first, then pod selection and payment at the end
        if (currentGuestIndex < partySize - 1) {
          // More guests to order - pass to next guest
          setView("pass");
        } else {
          // Last guest done - now do pod selection for everyone
          setCurrentGuestIndex(0); // Reset to first guest for pod selection
          setView("pod-selection");
        }
      } else {
        // Separate payment: each guest orders → pod → pays → next guest
        setView("pod-selection");
      }
    } catch (error) {
      console.error("Failed to submit order:", error);
      setErrorMessage("Failed to submit order. Please try again.");
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    setSubmitting(true);

    try {
      if (paymentType === "separate") {
        // Pay only current guest's order and assign pod
        const updates: any = { paymentStatus: "PAID", orderSource: "KIOSK" };
        if (currentGuest.selectedPodId) {
          updates.seatId = currentGuest.selectedPodId;
          updates.podSelectionMethod = "CUSTOMER_SELECTED";
          updates.podAssignedAt = new Date().toISOString();
          // Note: podConfirmedAt is NOT set here - customer must confirm at pod via QR scan
          updates.podReservationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }

        const response = await fetch(`${BASE}/orders/${currentGuest.orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error("Payment failed");

        updateCurrentGuest({ paid: true });

        // Move to next guest or complete
        if (currentGuestIndex < partySize - 1) {
          setView("pass");
        } else {
          setView("complete");
        }
      } else {
        // Single check - pay all orders and assign pods
        for (const guest of guestOrders) {
          if (guest.orderId) {
            const updates: any = { paymentStatus: "PAID", orderSource: "KIOSK" };
            if (guest.selectedPodId) {
              updates.seatId = guest.selectedPodId;
              updates.podSelectionMethod = "CUSTOMER_SELECTED";
              updates.podAssignedAt = new Date().toISOString();
              // Note: podConfirmedAt is NOT set here - customer must confirm at pod via QR scan
              updates.podReservationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            }

            await fetch(`${BASE}/orders/${guest.orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            });
          }
        }

        // Mark all as paid
        setGuestOrders((prev) => prev.map((g) => ({ ...g, paid: true })));
        setView("complete");
      }
    } catch (error) {
      console.error("Payment failed:", error);
      setErrorMessage("Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function passToNextGuest() {
    // Reset for next guest
    setCurrentGuestIndex((prev) => prev + 1);
    setCurrentStepIndex(0);
    setView("name");
  }

  function startOver() {
    // Go back to the kiosk welcome page with the location preserved
    router.push(`/kiosk?locationId=${location.id}`);
  }

  if (loading) {
    return (
      <main
        className="kiosk-screen"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          color: COLORS.text,
        }}
      >
        {/* Animated Oh! logo loader */}
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt="Loading..."
          style={{
            width: 200,
            height: 200,
            objectFit: "contain",
            animation: "spin-pulse 2s ease-in-out infinite",
          }}
        />
      </main>
    );
  }

  // Error display
  if (errorMessage) {
    return (
      <main
        className="kiosk-screen"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.surface,
          color: COLORS.text,
          padding: 48,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            background: "rgba(239, 68, 68, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke={COLORS.error} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="kiosk-subtitle" style={{ marginBottom: 12 }}>{tKiosk("orderFlow.somethingWentWrong")}</h1>
        <p className="kiosk-body" style={{ color: COLORS.textMuted, marginBottom: 40, textAlign: "center" }}>
          {errorMessage}
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <button
            onClick={() => setErrorMessage(null)}
            className="kiosk-btn kiosk-btn-secondary"
          >
            {tKiosk("orderFlow.tryAgain")}
          </button>
          <button
            onClick={startOver}
            className="kiosk-btn kiosk-btn-primary"
          >
            {tKiosk("orderFlow.startOver")}
          </button>
        </div>
      </main>
    );
  }

  // Name entry view
  if (view === "name") {
    return (
      <NameEntryView
        guestNumber={currentGuestIndex + 1}
        totalGuests={partySize}
        onSubmit={handleNameSubmit}
        onCancel={startOver}
      />
    );
  }

  // Menu building view
  if (view === "menu") {
    const currentStep = menuSteps[currentStepIndex];
    return (
      <MenuView
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={menuSteps.length}
        guestName={currentGuest.guestName}
        guestNumber={currentGuestIndex + 1}
        totalGuests={partySize}
        cart={currentGuest.cart}
        sliderLabels={currentGuest.sliderLabels}
        selections={currentGuest.selections}
        runningTotal={calculateRunningTotal()}
        onCartUpdate={handleCartUpdate}
        onSliderUpdate={handleSliderUpdate}
        onSelectionUpdate={handleSelectionUpdate}
        onNext={nextStep}
        onPrevious={previousStep}
        onCancel={startOver}
        canGoBack={currentStepIndex > 0}
        menuSteps={menuSteps}
      />
    );
  }

  // Order review view
  if (view === "review") {
    return (
      <ReviewView
        guestName={currentGuest.guestName}
        guestNumber={currentGuestIndex + 1}
        totalGuests={partySize}
        cart={currentGuest.cart}
        sliderLabels={currentGuest.sliderLabels}
        selections={currentGuest.selections}
        menuSteps={menuSteps}
        taxRate={location.taxRate}
        onSubmit={submitCurrentGuestOrder}
        onBack={() => setView("menu")}
        submitting={submitting}
      />
    );
  }

  // Pod selection view
  if (view === "pod-selection") {
    return (
      <PodSelectionView
        seats={seats}
        guestOrders={guestOrders}
        currentGuestIndex={currentGuestIndex}
        partySize={partySize}
        paymentType={paymentType}
        selectedPodId={currentGuest.selectedPodId}
        onSelectPod={handlePodSelection}
        onConfirm={handlePodConfirm}
        onBack={() => setView("review")}
      />
    );
  }

  // Pass to next guest view
  if (view === "pass") {
    return (
      <PassView
        completedGuestName={currentGuest.guestName}
        nextGuestNumber={currentGuestIndex + 2}
        totalGuests={partySize}
        dailyOrderNumber={currentGuest.dailyOrderNumber}
        paymentType={paymentType}
        selectedPod={seats.find((s) => s.id === currentGuest.selectedPodId)}
        onPassDevice={passToNextGuest}
      />
    );
  }

  // Payment view
  if (view === "payment") {
    return (
      <PaymentView
        paymentType={paymentType}
        guestOrders={guestOrders}
        currentGuestIndex={currentGuestIndex}
        seats={seats}
        taxRate={location.taxRate}
        onPay={handlePayment}
        onBack={() => setView("pod-selection")}
        submitting={submitting}
      />
    );
  }

  // Complete view
  if (view === "complete") {
    return (
      <CompleteView
        guestOrders={guestOrders}
        seats={seats}
        location={location}
        onNewOrder={startOver}
      />
    );
  }

  return null;
}

// ==================== Sub-components ====================

function NameEntryView({
  guestNumber,
  totalGuests,
  onSubmit,
  onCancel,
}: {
  guestNumber: number;
  totalGuests: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const tCommon = useTranslations("common");
  const tKiosk = useTranslations("kiosk");

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim().toUpperCase());
    }
  };

  return (
    <main
      className="kiosk-screen"
      style={{
        display: "flex",
        flexDirection: "column",
        background: COLORS.surface,
        color: COLORS.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%", // Cut off 30% of the logo (half of 30%)
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Large Brand Header - top left */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Language Selector - top right */}
      <div style={{ position: "absolute", top: 48, right: 48, zIndex: 1 }}>
        <LanguageSelector variant="compact" />
      </div>

      {/* Centered content area - title and input display */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 340, // Space for keyboard
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: "1.5rem", color: COLORS.textMuted, marginBottom: 12 }}>
          {tKiosk("orderFlow.guestOf", { current: guestNumber, total: totalGuests })}
        </div>
        <h1 className="kiosk-title" style={{ marginBottom: 40, textAlign: "center", fontSize: "3.5rem" }}>
          {tKiosk("orderFlow.whatsYourName")}
        </h1>

        {/* Name display field */}
        <div
          style={{
            background: COLORS.surface,
            border: `4px solid ${COLORS.primary}`,
            borderRadius: 20,
            padding: '4px 10px',
            minWidth: 500,
            minHeight: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <span
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '6rem',
              fontWeight: 700,
              color: name ? COLORS.text : COLORS.textMuted,
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}
          >
            {name || tKiosk("orderFlow.tapKeysBelow")}
          </span>
          {name && (
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: '1.2em',
                background: COLORS.primary,
                marginLeft: 4,
                animation: 'blink 1s infinite',
              }}
            />
          )}
        </div>

      </div>

      {/* Cancel button - bottom left */}
      <button
        onClick={onCancel}
        className="kiosk-btn"
        style={{
          position: "absolute",
          bottom: 24,
          left: 48,
          fontSize: "1.25rem",
          background: COLORS.primary,
          color: COLORS.textOnPrimary,
          zIndex: 2,
        }}
      >
        {tCommon("cancel")}
      </button>

      {/* Keyboard fixed at bottom - centered */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 48px 24px",
          display: "flex",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <VirtualKeyboard
          value={name}
          onChange={setName}
          onSubmit={handleSubmit}
          maxLength={25}
          showInput={false}
        />
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </main>
  );
}

function MenuView({
  step,
  stepIndex,
  totalSteps,
  guestName,
  guestNumber,
  totalGuests,
  cart,
  sliderLabels,
  selections,
  runningTotal,
  onCartUpdate,
  onSliderUpdate,
  onSelectionUpdate,
  onNext,
  onPrevious,
  onCancel,
  canGoBack,
  menuSteps,
}: {
  step: MenuStep;
  stepIndex: number;
  totalSteps: number;
  guestName: string;
  guestNumber: number;
  totalGuests: number;
  cart: Record<string, number>;
  sliderLabels: Record<string, string>;
  selections: Record<string, string>;
  runningTotal: number;
  onCartUpdate: (itemId: string, quantity: number, maxQuantity?: number) => void;
  onSliderUpdate: (itemId: string, value: number, label: string) => void;
  onSelectionUpdate: (sectionId: string, itemId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onCancel: () => void;
  canGoBack: boolean;
  menuSteps: MenuStep[];
}) {
  const t = useTranslations("order");
  const tCommon = useTranslations("common");
  const tKiosk = useTranslations("kiosk");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true); // Start visible
  const [showAllergenPopup, setShowAllergenPopup] = useState(false);

  // Helper to translate slider labels
  const translateSliderLabel = (label: string): string => {
    try {
      const key = `builder.sliderLabels.${label}` as any;
      const translated = t(key);
      if (translated && translated !== key) {
        return translated;
      }
    } catch {
      // Fall through to return original
    }
    return label;
  };

  // Check if there's content below the fold - update on scroll
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const hasOverflow = container.scrollHeight > container.clientHeight + 10; // 10px buffer
      // Show hint if there's overflow AND user hasn't scrolled to bottom (with 100px threshold)
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
      setShowScrollHint(hasOverflow && !isNearBottom);
    }
  }, []);

  // Scroll to top and check position on step change
  useEffect(() => {
    // Scroll the container to top when step changes
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    // Also scroll window for safety
    window.scrollTo({ top: 0, behavior: "instant" });
    // Check scroll position immediately
    checkScrollPosition();
    // Also check after a delay for images/content to load
    const timer1 = setTimeout(checkScrollPosition, 300);
    const timer2 = setTimeout(checkScrollPosition, 800);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [step, checkScrollPosition]);

  // Handle scroll to update hint visibility
  const handleScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  // Handle slider change (no auto-scroll)
  const handleSliderChange = (itemId: string, value: number, labels: string[], defaultValue: number) => {
    onSliderUpdate(itemId, value, labels[value] || String(value));
  };

  // Check if this is the drinks & dessert step (multi-language)
  const isDrinksAndDessertStep = (() => {
    const lower = step.title.toLowerCase();
    // English
    if (lower.includes("drink") || lower.includes("dessert") || lower.includes("beverage")) return true;
    // Spanish
    if (lower.includes("bebida") || lower.includes("postre")) return true;
    // Chinese
    if (step.title.includes("飲") || step.title.includes("饮") || step.title.includes("甜") || step.title.includes("點心") || step.title.includes("点心")) return true;
    return false;
  })();

  // Check if required selections are made for current step (step 1 = Build the Foundation)
  // On step 1, both soup and noodles sections must have a selection
  const isStep1 = stepIndex === 0;
  const requiredSectionsMet = step.sections
    .filter((section) => section.required)
    .every((section) => selections[section.id]);

  // Disable Next if step 1 requirements not met
  const canProceed = !isStep1 || requiredSectionsMet;

  return (
    <main
      style={{
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
        background: COLORS.surface,
        color: COLORS.text,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%",
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Fixed Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: COLORS.primaryLight,
          padding: "20px 32px",
          borderBottom: `1px solid ${COLORS.primaryBorder}`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Left: Guest info and step title */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.1rem", color: COLORS.textMuted }}>
              {tKiosk("orderFlow.guestsOrder", { name: guestName, current: guestNumber, total: totalGuests })}
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "4px 0 0 0" }}>{step.title}</h1>
          </div>

          {/* Center: Brand - 3x larger */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <KioskBrand size="large" />
          </div>

          {/* Right: Step indicator with text - 2x larger */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "1.6rem", color: COLORS.text, fontWeight: 700 }}>
              {tKiosk("orderFlow.stepOf", { current: stepIndex + 1, total: totalSteps })}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === stepIndex ? 56 : 20,
                    height: 20,
                    borderRadius: 10,
                    background: i <= stepIndex ? COLORS.primary : COLORS.border,
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content - use more space */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          paddingBottom: 220,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Legend for slider recommendation indicator */}
          {step.sections.some((s) => s.selectionMode === "SLIDER") && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                marginBottom: 20,
                fontSize: "1.1rem",
                color: COLORS.text,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 8,
                  border: `2px dashed ${COLORS.primary}`,
                }}
              />
              <span style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "1.5rem" }}>=</span> <span style={{ fontFamily: '"Ma Shan Zheng", cursive', color: "#C7A878", fontSize: "1.5rem" }}>哦</span> {tKiosk("orderFlow.ohRecommendation")}
              </span>
            </div>
          )}
          {/* Step 1: Show required sections side by side */}
          {isStep1 && (
            <div style={{ display: "flex", gap: 40, marginBottom: 28 }}>
              {step.sections.filter(s => s.required && s.selectionMode === "SINGLE").map((section) => (
                <div key={section.id} style={{ flex: 1 }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 4, color: COLORS.text, textAlign: "center" }}>
                    {section.name
                      .replace(/Premium Add-?[Oo]ns/i, "Add-Ons")
                      .replace("Choose Your Noodles", "Choose Your Noodle Style")}
                    <span style={{ color: COLORS.primary, marginLeft: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                      {t("builder.required")}
                    </span>
                  </h2>
                  {section.description && (
                    <p style={{ color: COLORS.textMuted, marginBottom: 10, marginTop: 0, fontSize: "0.85rem", lineHeight: 1.3, textAlign: "center" }}>
                      {section.description}
                    </p>
                  )}
                  {(() => {
                    const isNoodleSection = section.name.toLowerCase().includes("noodle") ||
                      section.name.toLowerCase().includes("fideos") ||
                      section.name.includes("麵") ||
                      section.name.includes("面");
                    // Match "No Noodles" in English, Chinese (不要麵/不要面/無麵/无面), or Spanish (sin fideos)
                    const isNoNoodlesItem = (item: MenuItem) => {
                      const lowerName = item.name.toLowerCase();
                      return lowerName.includes("no noodle") ||
                        lowerName.includes("sin fideos") ||
                        item.name.includes("不要麵") ||
                        item.name.includes("不要面") ||
                        item.name.includes("無麵") ||
                        item.name.includes("无面");
                    };
                    const noNoodlesItem = isNoodleSection ? section.items?.find(isNoNoodlesItem) : null;
                    const gridItems = isNoodleSection ? section.items?.filter(item => !isNoNoodlesItem(item)) : section.items;
                    const hasSelection = !!selections[section.id];

                    return (
                      <>
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: 12,
                        }}>
                          {gridItems?.map((item) => {
                            const isSelected = selections[section.id] === item.id;
                            const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];

                            return (
                              <button
                                key={item.id}
                                onClick={() => onSelectionUpdate(section.id, item.id)}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  padding: 0,
                                  background: isSelected ? COLORS.primaryLight : COLORS.surfaceElevated,
                                  border: isSelected
                                    ? `3px solid ${COLORS.primary}`
                                    : `2px solid ${COLORS.border}`,
                                  borderRadius: 12,
                                  overflow: "hidden",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                  textAlign: "left",
                                  position: "relative",
                                  opacity: hasSelection && !isSelected ? 0.3 : 1,
                                }}
                              >
                                {imageUrl ? (
                                  <div
                                    style={{
                                      width: "100%",
                                      aspectRatio: "4 / 3",
                                      background: "#f5f5f5",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                      position: "relative",
                                    }}
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={item.name}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                    {/* Dietary badges - top left */}
                                    <div style={{ position: "absolute", top: 6, left: 6 }}>
                                      <DietaryBadges
                                        isVegetarian={item.isVegetarian}
                                        isVegan={item.isVegan}
                                        isGlutenFree={item.isGlutenFree}
                                        spiceLevel={item.spiceLevel}
                                        size="small"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      width: "100%",
                                      aspectRatio: "4 / 3",
                                      background: "#f5f5f5",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      position: "relative",
                                    }}
                                  >
                                    <span style={{ fontSize: "3rem" }}>🍜</span>
                                    {/* Dietary badges - top left */}
                                    <div style={{ position: "absolute", top: 6, left: 6 }}>
                                      <DietaryBadges
                                        isVegetarian={item.isVegetarian}
                                        isVegan={item.isVegan}
                                        isGlutenFree={item.isGlutenFree}
                                        spiceLevel={item.spiceLevel}
                                        size="small"
                                      />
                                    </div>
                                  </div>
                                )}
                                <div style={{ padding: 8 }}>
                                  <div style={{ fontWeight: 700, fontSize: "1rem", color: COLORS.text }}>
                                    {item.name}
                                  </div>
                                  {item.basePriceCents > 0 ? (
                                    <div style={{ color: COLORS.primary, fontSize: "1.1rem", marginTop: 2, fontWeight: 700 }}>
                                      ${(item.basePriceCents / 100).toFixed(2)}
                                    </div>
                                  ) : (
                                    <div style={{ color: COLORS.primary, fontSize: "1.1rem", marginTop: 2, fontWeight: 700 }}>
                                      ({t("builder.included")})
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: 8,
                                      right: 8,
                                      width: 48,
                                      height: 48,
                                      borderRadius: 24,
                                      background: "rgba(245, 243, 239, 0.5)",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: "1.4rem", color: "#C7A878", lineHeight: 1 }}>哦!</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="3">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {/* No Noodles button - centered below the grid */}
                        {noNoodlesItem && (
                          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                            <button
                              onClick={() => onSelectionUpdate(section.id, noNoodlesItem.id)}
                              style={{
                                padding: "12px 32px",
                                background: selections[section.id] === noNoodlesItem.id ? COLORS.primaryDark : COLORS.primary,
                                border: selections[section.id] === noNoodlesItem.id
                                  ? `3px solid ${COLORS.primaryDark}`
                                  : `2px solid ${COLORS.primary}`,
                                borderRadius: 12,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                opacity: hasSelection && selections[section.id] !== noNoodlesItem.id ? 0.3 : 1,
                              }}
                            >
                              <span style={{ fontSize: "1.2rem", color: COLORS.textOnPrimary, fontWeight: 700 }}>
                                {noNoodlesItem.name} 🚫
                              </span>
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Add-Ons & Sides - side by side layout */}
          {(() => {
            // Helper to detect add-ons section in any language
            const isAddOnSection = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("add-on") || lower.includes("addon") ||
                lower.includes("extras") || lower.includes("adicional") ||
                name.includes("加購") || name.includes("加购") ||
                name.includes("加料") || name.includes("配料") || name.includes("加點") || name.includes("加点");
            };
            // Helper to detect sides section in any language
            const isSideSection = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("side") || lower.includes("acompañamiento") ||
                name.includes("配菜") || name.includes("小菜");
            };

            const isStep3 = step.title?.toLowerCase().includes("add-on") ||
              step.sections.some(s => isAddOnSection(s.name) && s.selectionMode === "MULTIPLE");
            if (!isStep3) return null;

            const addOnsSection = step.sections.find(s => isAddOnSection(s.name));
            const sidesSection = step.sections.find(s => isSideSection(s.name));

            if (!addOnsSection && !sidesSection) return null;

            return (
              <div style={{ display: "flex", gap: 32, marginBottom: 28 }}>
                {/* Add-Ons Column */}
                {addOnsSection && addOnsSection.items && (
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8, color: COLORS.text, textAlign: "center" }}>
                      {addOnsSection.name.replace(/Premium /i, "")}
                    </h2>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 10,
                    }}>
                      {addOnsSection.items.map((item) => {
                        const qty = cart[item.id] || 0;
                        const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];
                        const maxQty = addOnsSection.maxQuantity;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (maxQty === undefined || qty < maxQty) {
                                onCartUpdate(item.id, qty + 1, maxQty);
                              }
                            }}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: 0,
                              background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                              border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                              borderRadius: 10,
                              overflow: "hidden",
                              transition: "all 0.2s",
                              position: "relative",
                              cursor: maxQty !== undefined && qty >= maxQty ? "not-allowed" : "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "4 / 3",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <span style={{ fontSize: "3rem" }}>🍽️</span>
                              )}
                              <div style={{ position: "absolute", top: 6, left: 6 }}>
                                <DietaryBadges
                                  isVegetarian={item.isVegetarian}
                                  isVegan={item.isVegan}
                                  isGlutenFree={item.isGlutenFree}
                                  spiceLevel={item.spiceLevel}
                                  size="small"
                                />
                              </div>
                            </div>
                            {/* Name, price, and qty controls - qty on right side */}
                            <div style={{ padding: 8, display: "flex", alignItems: "center", width: "100%" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: "1rem", color: COLORS.text }}>{item.name}</div>
                                {item.basePriceCents > 0 && (
                                  <div style={{ color: COLORS.primary, fontSize: "1.1rem", marginTop: 2, fontWeight: 700 }}>
                                    ${(item.basePriceCents / 100).toFixed(2)} <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>each</span>
                                  </div>
                                )}
                              </div>
                              {/* Qty display with minus button - right side */}
                              {qty > 0 && (
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCartUpdate(item.id, Math.max(0, qty - 1));
                                    }}
                                    style={{
                                      width: 29,
                                      height: 29,
                                      borderRadius: 6,
                                      border: "none",
                                      background: COLORS.primary,
                                      color: COLORS.textOnPrimary,
                                      fontSize: "1.2rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontSize: "1.75rem", fontWeight: 700, color: COLORS.text, minWidth: 24, textAlign: "right" }}>
                                    {qty}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Side Dishes Column */}
                {sidesSection && sidesSection.items && (
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8, color: COLORS.text, textAlign: "center" }}>
                      {sidesSection.name}
                    </h2>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 10,
                    }}>
                      {sidesSection.items.map((item) => {
                        const qty = cart[item.id] || 0;
                        const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];
                        const maxQty = sidesSection.maxQuantity;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (maxQty === undefined || qty < maxQty) {
                                onCartUpdate(item.id, qty + 1, maxQty);
                              }
                            }}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: 0,
                              background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                              border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                              borderRadius: 10,
                              overflow: "hidden",
                              transition: "all 0.2s",
                              position: "relative",
                              cursor: maxQty !== undefined && qty >= maxQty ? "not-allowed" : "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "4 / 3",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <span style={{ fontSize: "3rem" }}>🍽️</span>
                              )}
                              <div style={{ position: "absolute", top: 6, left: 6 }}>
                                <DietaryBadges
                                  isVegetarian={item.isVegetarian}
                                  isVegan={item.isVegan}
                                  isGlutenFree={item.isGlutenFree}
                                  spiceLevel={item.spiceLevel}
                                  size="small"
                                />
                              </div>
                            </div>
                            {/* Name, price, and qty controls - qty on right side */}
                            <div style={{ padding: 8, display: "flex", alignItems: "center", width: "100%" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: "1rem", color: COLORS.text }}>{item.name}</div>
                                {item.basePriceCents > 0 && (
                                  <div style={{ color: COLORS.primary, fontSize: "1.1rem", marginTop: 2, fontWeight: 700 }}>
                                    ${(item.basePriceCents / 100).toFixed(2)} <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>each</span>
                                  </div>
                                )}
                              </div>
                              {/* Qty display with minus button - right side */}
                              {qty > 0 && (
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCartUpdate(item.id, Math.max(0, qty - 1));
                                    }}
                                    style={{
                                      width: 29,
                                      height: 29,
                                      borderRadius: 6,
                                      border: "none",
                                      background: COLORS.primary,
                                      color: COLORS.textOnPrimary,
                                      fontSize: "1.2rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontSize: "1.75rem", fontWeight: 700, color: COLORS.text, minWidth: 24, textAlign: "right" }}>
                                    {qty}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Step 4: Drinks & Dessert - side by side layout */}
          {(() => {
            const isStep4 = isDrinksAndDessertStep;
            if (!isStep4) return null;

            // Multi-language beverage detection
            const isBeverageSection = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("drink") || lower.includes("beverage") ||
                lower.includes("bebida") ||
                name.includes("飲") || name.includes("饮") || name.includes("飲料") || name.includes("饮料");
            };
            // Multi-language dessert detection
            const isDessertSection = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("dessert") ||
                lower.includes("postre") ||
                name.includes("甜") || name.includes("點心") || name.includes("点心") || name.includes("甜點") || name.includes("甜点");
            };

            const beveragesSection = step.sections.find(s => isBeverageSection(s.name));
            const dessertSection = step.sections.find(s => isDessertSection(s.name));

            if (!beveragesSection && !dessertSection) return null;

            return (
              <div style={{ display: "flex", gap: 32, marginBottom: 28 }}>
                {/* Beverages Column */}
                {beveragesSection && beveragesSection.items && (
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8, color: COLORS.text, textAlign: "center" }}>
                      {beveragesSection.name} <span style={{ fontWeight: 500, fontSize: "0.9rem", color: COLORS.textMuted }}>({tKiosk("orderFlow.freeRefills")})</span>
                    </h2>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 10,
                    }}>
                      {beveragesSection.items.map((item) => {
                        const qty = cart[item.id] || 0;
                        const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];
                        const maxQty = beveragesSection.maxQuantity || 1;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (qty === 0) {
                                onCartUpdate(item.id, 1, maxQty);
                              }
                            }}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: 0,
                              background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                              border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                              borderRadius: 10,
                              overflow: "hidden",
                              transition: "all 0.2s",
                              position: "relative",
                              cursor: qty > 0 ? "default" : "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "4 / 3",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <span style={{ fontSize: "3rem" }}>🥤</span>
                              )}
                              <div style={{ position: "absolute", top: 6, left: 6 }}>
                                <DietaryBadges
                                  isVegetarian={item.isVegetarian}
                                  isVegan={item.isVegan}
                                  isGlutenFree={item.isGlutenFree}
                                  spiceLevel={item.spiceLevel}
                                  size="small"
                                />
                              </div>
                            </div>
                            {/* Name, price, and qty controls */}
                            <div style={{ padding: 8, display: "flex", alignItems: "center", width: "100%" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: "1rem", color: COLORS.text }}>{item.name}</div>
                                <div style={{ color: item.basePriceCents > 0 ? COLORS.primary : COLORS.success, fontSize: "1.1rem", marginTop: 2, fontWeight: 700 }}>
                                  {item.basePriceCents > 0 ? `$${(item.basePriceCents / 100).toFixed(2)}` : tKiosk("orderFlow.free")}
                                </div>
                              </div>
                              {/* Qty display with minus button - right side */}
                              {qty > 0 && (
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCartUpdate(item.id, 0);
                                    }}
                                    style={{
                                      width: 29,
                                      height: 29,
                                      borderRadius: 6,
                                      border: "none",
                                      background: COLORS.primary,
                                      color: COLORS.textOnPrimary,
                                      fontSize: "1.2rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontSize: "1.75rem", fontWeight: 700, color: COLORS.text, minWidth: 24, textAlign: "right" }}>
                                    {qty}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Dessert Column */}
                {dessertSection && dessertSection.items && (
                  <div style={{ flex: 1, borderLeft: `2px solid ${COLORS.border}`, paddingLeft: 32 }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8, color: COLORS.text, textAlign: "center" }}>
                      {dessertSection.name} <span style={{ fontWeight: 500, fontSize: "0.9rem", color: COLORS.textMuted }}>({tKiosk("orderFlow.free")})</span>
                    </h2>
                    <div style={{
                      display: "flex",
                      justifyContent: "center",
                    }}>
                      {dessertSection.items.map((item) => {
                        const qty = cart[item.id] || 0;
                        const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];
                        const maxQty = dessertSection.maxQuantity || 1;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (qty === 0) {
                                onCartUpdate(item.id, 1, maxQty);
                              }
                            }}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              padding: 0,
                              background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                              border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                              borderRadius: 10,
                              overflow: "hidden",
                              transition: "all 0.2s",
                              position: "relative",
                              cursor: qty > 0 ? "default" : "pointer",
                              textAlign: "left",
                              width: "calc(50% - 5px)",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "4 / 3",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <span style={{ fontSize: "3rem" }}>🍨</span>
                              )}
                              <div style={{ position: "absolute", top: 6, left: 6 }}>
                                <DietaryBadges
                                  isVegetarian={item.isVegetarian}
                                  isVegan={item.isVegan}
                                  isGlutenFree={item.isGlutenFree}
                                  spiceLevel={item.spiceLevel}
                                  size="small"
                                />
                              </div>
                            </div>
                            {/* Name, price, and qty controls */}
                            <div style={{ padding: 8, display: "flex", alignItems: "center", width: "100%" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: "1rem", color: COLORS.text }}>{item.name}</div>
                                <div style={{ color: item.basePriceCents > 0 ? COLORS.primary : COLORS.success, fontSize: "1.1rem", marginTop: 2, fontWeight: 700 }}>
                                  {item.basePriceCents > 0 ? `$${(item.basePriceCents / 100).toFixed(2)}` : tKiosk("orderFlow.free")}
                                </div>
                              </div>
                              {/* Qty display with minus button - right side */}
                              {qty > 0 && (
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCartUpdate(item.id, 0);
                                    }}
                                    style={{
                                      width: 29,
                                      height: 29,
                                      borderRadius: 6,
                                      border: "none",
                                      background: COLORS.primary,
                                      color: COLORS.textOnPrimary,
                                      fontSize: "1.2rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontSize: "1.75rem", fontWeight: 700, color: COLORS.text, minWidth: 24, textAlign: "right" }}>
                                    {qty}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Check if this is a slider-only step (Customize Your Bowl) */}
          {(() => {
            // Helper to detect add-ons section in any language
            const isAddOnSection = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("add-on") || lower.includes("addon") ||
                lower.includes("extras") || lower.includes("adicional") ||
                name.includes("加購") || name.includes("加购") ||
                name.includes("加料") || name.includes("配料") || name.includes("加點") || name.includes("加点");
            };
            // Helper to detect sides section in any language
            const isSideSection = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("side") || lower.includes("acompañamiento") ||
                name.includes("配菜") || name.includes("小菜");
            };

            // Check if Step 3 (Add-Ons & Sides) - handled by special layout above
            const isStep3 = step.title?.toLowerCase().includes("add-on") ||
              step.sections.some(s => isAddOnSection(s.name) && s.selectionMode === "MULTIPLE");

            // Multi-language beverage detection for filtering
            const isBeverageSectionFilter = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("drink") || lower.includes("beverage") ||
                lower.includes("bebida") ||
                name.includes("飲") || name.includes("饮") || name.includes("飲料") || name.includes("饮料");
            };
            // Multi-language dessert detection for filtering
            const isDessertSectionFilter = (name: string) => {
              const lower = name.toLowerCase();
              return lower.includes("dessert") ||
                lower.includes("postre") ||
                name.includes("甜") || name.includes("點心") || name.includes("点心") || name.includes("甜點") || name.includes("甜点");
            };

            // Filter out sections handled by special layouts
            const filteredSections = step.sections.filter(section => {
              // Skip Step 1 required SINGLE sections (handled above)
              if (isStep1 && section.required && section.selectionMode === "SINGLE") return false;
              // Skip Step 3 Add-Ons and Sides sections (handled above)
              if (isStep3 && (isAddOnSection(section.name) || isSideSection(section.name))) return false;
              // Skip Step 4 Drinks and Dessert sections (handled above)
              if (isDrinksAndDessertStep && (isBeverageSectionFilter(section.name) || isDessertSectionFilter(section.name))) return false;
              return true;
            });
            const allSliders = filteredSections.every(s => s.selectionMode === "SLIDER");
            const sliderSections = filteredSections.filter(s => s.selectionMode === "SLIDER");
            const nonSliderSections = filteredSections.filter(s => s.selectionMode !== "SLIDER");

            return (
              <>
                {/* Render sliders in 2-column grid if all sections are sliders */}
                {allSliders && sliderSections.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 12,
                    }}
                  >
                    {sliderSections.map((section) => (
                      <div key={section.id} id={`section-${section.item?.id || section.id}`}>
                        {section.selectionMode === "SLIDER" && section.item && section.sliderConfig && (() => {
                          const sliderName = section.name.toLowerCase();
                          const itemName = section.item!.name.toLowerCase();
                          const sliderValue = cart[section.item!.id] || 0;

                          // Spice Level - Progressive red (English, Chinese, Spanish)
                          const isSpiceSlider = sliderName.includes("spice") ||
                            section.name.includes("辣") || section.name.includes("辛") ||
                            sliderName.includes("picante");
                          const spiceColors = [
                            null,
                            "rgba(244, 114, 182, 0.6)",
                            "rgba(239, 68, 68, 0.7)",
                            "rgba(220, 38, 38, 0.85)",
                            "rgba(185, 28, 28, 1)",
                          ];

                          // Soup Richness - Progressive deep brown (English, Chinese, Spanish)
                          const isRichnessSlider = sliderName.includes("richness") || sliderName.includes("broth") ||
                            section.name.includes("濃") || section.name.includes("浓") || section.name.includes("湯") || section.name.includes("汤") ||
                            sliderName.includes("intensidad") || sliderName.includes("caldo");
                          const richnessColors = [
                            "rgba(139, 90, 43, 0.4)",    // Light - subtle brown
                            "rgba(120, 70, 30, 0.6)",    // Medium - moderate brown
                            "rgba(101, 55, 20, 0.85)",   // Rich - deeper brown
                            "rgba(75, 40, 10, 1)",       // Extra Rich - deep dark brown
                          ];

                          // Noodle Texture - Tan colors (English, Chinese, Spanish)
                          const isTextureSlider = sliderName.includes("texture") || sliderName.includes("noodle texture") ||
                            section.name.includes("麵") || section.name.includes("面") || section.name.includes("口感") ||
                            sliderName.includes("textura") || sliderName.includes("firmeza");
                          const textureColors = [
                            "rgba(139, 90, 43, 0.85)",  // Firm - bold tan
                            "rgba(160, 120, 70, 0.6)",  // Medium - normal tan
                            "rgba(180, 150, 100, 0.4)", // Soft - light tan
                          ];

                          // Vegetables - Deep green (English, Chinese, Spanish)
                          const isVegetableSlider = ["bok choy", "green onion", "sprout", "cilantro", "pickled green",
                            "青江菜", "蔥", "葱", "芽", "香菜", "酸菜",
                            "cebollín", "germinado", "brote", "cilantro", "verdura", "soja"].some(
                            veg => itemName.includes(veg.toLowerCase()) || section.item!.name.includes(veg)
                          );
                          const vegetableColors = [
                            null,                        // None
                            "rgba(34, 139, 34, 0.5)",    // Light amount
                            "rgba(34, 139, 34, 0.7)",    // Medium amount
                            "rgba(22, 101, 52, 0.85)",   // More
                            "rgba(20, 83, 45, 1)",       // Extra
                          ];

                          // Determine border color and width based on slider type
                          let borderColor: string | null = null;
                          let borderWidth = 2;
                          let glowColor: string | null = null;
                          let glowSize = 0;

                          if (isSpiceSlider && sliderValue > 0) {
                            borderColor = spiceColors[sliderValue];
                            borderWidth = sliderValue === 4 ? 4 : sliderValue >= 2 ? 3 : 2;
                            if (sliderValue >= 2) {
                              glowColor = spiceColors[sliderValue];
                              glowSize = sliderValue >= 3 ? 12 : 6;
                            }
                          } else if (isRichnessSlider) {
                            borderColor = richnessColors[sliderValue];
                            borderWidth = sliderValue >= 3 ? 4 : sliderValue >= 2 ? 3 : 2;
                            if (sliderValue >= 2) {
                              glowColor = richnessColors[sliderValue];
                              glowSize = sliderValue >= 3 ? 10 : 5;
                            }
                          } else if (isTextureSlider) {
                            borderColor = textureColors[sliderValue];
                            borderWidth = sliderValue === 0 ? 3 : 2; // Firm gets bolder border
                            if (sliderValue === 0) {
                              glowColor = textureColors[0];
                              glowSize = 6;
                            }
                          } else if (isVegetableSlider && sliderValue > 0) {
                            borderColor = vegetableColors[sliderValue];
                            borderWidth = sliderValue >= 3 ? 3 : 2;
                            if (sliderValue >= 2) {
                              glowColor = vegetableColors[sliderValue];
                              glowSize = sliderValue >= 3 ? 8 : 4;
                            }
                          }

                          // Get image URL for vegetable sliders
                          const imageUrl = isVegetableSlider ? (MENU_IMAGES[section.item!.nameEn || section.item!.name] || MENU_IMAGES[section.item!.name]) : null;

                          return (
                            <div
                              style={{
                                background: COLORS.surfaceElevated,
                                borderRadius: 10,
                                border: borderColor
                                  ? `${borderWidth}px solid ${borderColor}`
                                  : `2px solid ${COLORS.border}`,
                                boxShadow: glowColor && glowSize > 0
                                  ? `0 0 ${glowSize}px ${glowColor}`
                                  : undefined,
                                overflow: "hidden",
                                transition: "all 0.3s ease",
                                display: "flex",
                                alignItems: "stretch",
                              }}
                            >
                              {/* Thumbnail for vegetable sliders */}
                              {isVegetableSlider && imageUrl && (
                                <div
                                  style={{
                                    width: 100,
                                    minHeight: 90,
                                    flexShrink: 0,
                                    background: "#f5f5f5",
                                    position: "relative",
                                  }}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={section.item!.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                              )}

                              <div style={{ flex: 1, padding: 12 }}>
                                {/* Compact header with name */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: COLORS.text }}>{section.item.name}</span>
                                  <DietaryBadges
                                    isVegetarian={section.item.isVegetarian}
                                    isVegan={section.item.isVegan}
                                    isGlutenFree={section.item.isGlutenFree}
                                    spiceLevel={section.item.spiceLevel}
                                    size="small"
                                  />
                                </div>

                                {/* Compact slider */}
                                <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                                  <input
                                    type="range"
                                    className="kiosk-slider"
                                    min={section.sliderConfig.min || 0}
                                    max={section.sliderConfig.max || 3}
                                    value={cart[section.item.id] || 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      const labels = section.sliderConfig.labels || [];
                                      handleSliderChange(section.item!.id, val, labels, section.sliderConfig.default ?? 0);
                                    }}
                                    style={{ width: "100%", height: 8, cursor: "pointer" }}
                                  />
                                </div>

                                {/* Compact labels */}
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingLeft: 8, paddingRight: 8 }}>
                                  {section.sliderConfig.labels?.map((label: string, i: number) => {
                                    const isDefault = i === (section.sliderConfig.default ?? 0);
                                    const isSelected = cart[section.item!.id] === i;
                                    return (
                                      <span
                                        key={i}
                                        style={{
                                          fontSize: "0.75rem",
                                          color: isSelected ? COLORS.primary : COLORS.textMuted,
                                          fontWeight: isSelected ? 700 : 500,
                                          padding: isDefault ? "2px 6px" : undefined,
                                          border: isDefault ? `1.5px dashed ${COLORS.primary}` : undefined,
                                          borderRadius: isDefault ? 4 : undefined,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {translateSliderLabel(label)}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Render non-slider sections normally */}
                {nonSliderSections.map((section) => (
                  <div
                    key={section.id}
                    id={`section-${section.item?.id || section.id}`}
                    style={{ marginBottom: 28 }}
                  >
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 4, color: COLORS.text }}>
                      {section.name
                        .replace(/Premium Add-?[Oo]ns/i, "Add-Ons")
                        .replace("Choose Your Noodles", "Choose Your Noodle Style")}
                      {section.required && (
                        <span style={{ color: COLORS.primary, marginLeft: 8, fontSize: "0.9rem", fontWeight: 600 }}>
                          {t("builder.required")}
                        </span>
                      )}
                    </h2>
                    {section.description && (
                      <p style={{ color: COLORS.textMuted, marginBottom: 10, marginTop: 0, fontSize: "0.9rem", lineHeight: 1.3 }}>
                        {section.description.includes("recommend") ? (
                          <>
                            {section.description.split(/\b(Light|Medium|Rich|Extra Rich|Firm|Soft|None|Mild|Spicy|Extra Spicy)\b/).map((part, i) =>
                              ["Light", "Medium", "Rich", "Extra Rich", "Firm", "Soft", "None", "Mild", "Spicy", "Extra Spicy"].includes(part) ? (
                                <strong key={i} style={{ color: COLORS.primary }}>{part}</strong>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )}
                          </>
                        ) : (
                          section.description
                        )}
                      </p>
                    )}

              {/* Radio selection mode with images - compact cards */}
              {section.selectionMode === "SINGLE" && section.items && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 350px))",
                  gap: 12,
                }}>
                  {section.items.map((item) => {
                    const isSelected = selections[section.id] === item.id;
                    const hasSelection = !!selections[section.id];
                    const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];
                    const lowerItemName = item.name.toLowerCase();
                    const isNoNoodles = lowerItemName.includes("no noodle") ||
                      lowerItemName.includes("sin fideos") ||
                      item.name.includes("不要麵") ||
                      item.name.includes("不要面") ||
                      item.name.includes("無麵") ||
                      item.name.includes("无面");

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectionUpdate(section.id, item.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          padding: 0,
                          background: isSelected ? COLORS.primaryLight : COLORS.surfaceElevated,
                          border: isSelected
                            ? `3px solid ${COLORS.primary}`
                            : `2px solid ${COLORS.border}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          textAlign: "left",
                          position: "relative",
                          opacity: hasSelection && !isSelected ? 0.3 : 1,
                        }}
                      >
                        {imageUrl ? (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            <img
                              src={imageUrl}
                              alt={item.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                            {/* Dietary badges - top left */}
                            <div style={{ position: "absolute", top: 8, left: 8 }}>
                              <DietaryBadges
                                isVegetarian={item.isVegetarian}
                                isVegan={item.isVegan}
                                isGlutenFree={item.isGlutenFree}
                                spiceLevel={item.spiceLevel}
                                size="normal"
                              />
                            </div>
                          </div>
                        ) : isNoNoodles ? (
                          // Olive "No Noodles" button
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#6B8E23",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: "1.8rem", color: "#fff", fontWeight: 700, textAlign: "center" }}>
                              {tKiosk("orderFlow.noNoodles")} 🚫
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                            }}
                          >
                            <span style={{ fontSize: "4rem" }}>🍜</span>
                            {/* Dietary badges - top left */}
                            <div style={{ position: "absolute", top: 8, left: 8 }}>
                              <DietaryBadges
                                isVegetarian={item.isVegetarian}
                                isVegan={item.isVegan}
                                isGlutenFree={item.isGlutenFree}
                                spiceLevel={item.spiceLevel}
                                size="normal"
                              />
                            </div>
                          </div>
                        )}
                        <div style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: "1.15rem", color: COLORS.text }}>
                            {item.name}
                          </div>
                          {item.basePriceCents > 0 && (
                            <div style={{ color: COLORS.primary, fontSize: "1rem", marginTop: 3, fontWeight: 700 }}>
                              ${(item.basePriceCents / 100).toFixed(2)}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div
                            style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              width: 72,
                              height: 72,
                              borderRadius: 36,
                              background: "rgba(245, 243, 239, 0.5)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 2,
                            }}
                          >
                            <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: "2rem", color: "#C7A878", lineHeight: 1 }}>哦!</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multiple selection mode with images and prices */}
              {section.selectionMode === "MULTIPLE" && section.items && (() => {
                const sectionLower = section.name.toLowerCase();
                const isAddOnsSection = sectionLower.includes("add-on") || sectionLower.includes("addon") ||
                  sectionLower.includes("extras") || sectionLower.includes("adicional") ||
                  section.name.includes("加購") || section.name.includes("加购") ||
                  section.name.includes("加料") || section.name.includes("配料") ||
                  section.name.includes("加點") || section.name.includes("加点");
                const isSidesSection = sectionLower.includes("side") || sectionLower.includes("acompañamiento") ||
                  section.name.includes("配菜") || section.name.includes("小菜");
                const isStep3Style = isAddOnsSection || isSidesSection;

                // Use fixed 2-column grid for Add-Ons & Sides (Step 3 style)
                const gridColumns = isStep3Style ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(300px, 350px))";

                return (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: gridColumns,
                    gap: 12,
                  }}>
                    {section.items.map((item) => {
                      const qty = cart[item.id] || 0;
                      const imageUrl = MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name];
                      const maxQty = section.maxQuantity;
                      const itemPrice = calculateItemPrice(item, qty);
                      const isComplimentary = item.basePriceCents === 0 && item.additionalPriceCents === 0;
                      const isDessert = item.category?.toLowerCase() === "dessert" ||
                        section.name.toLowerCase().includes("dessert") || section.name.toLowerCase().includes("postre") ||
                        section.name.includes("甜") || section.name.includes("點心") || section.name.includes("点心");

                      // Step 3 style - simpler cards matching Step 1
                      if (isStep3Style) {
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                              border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                              borderRadius: 12,
                              overflow: "hidden",
                              transition: "all 0.2s",
                              position: "relative",
                            }}
                          >
                            {imageUrl ? (
                              <div
                                style={{
                                  width: "100%",
                                  aspectRatio: "1 / 1",
                                  background: "#f5f5f5",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  position: "relative",
                                }}
                              >
                                <img
                                  src={imageUrl}
                                  alt={item.name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                                {/* Dietary badges - top left */}
                                <div style={{ position: "absolute", top: 8, left: 8 }}>
                                  <DietaryBadges
                                    isVegetarian={item.isVegetarian}
                                    isVegan={item.isVegan}
                                    isGlutenFree={item.isGlutenFree}
                                    spiceLevel={item.spiceLevel}
                                    size="normal"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  aspectRatio: "1 / 1",
                                  background: "#f5f5f5",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  position: "relative",
                                }}
                              >
                                <span style={{ fontSize: "4rem" }}>🍽️</span>
                                <div style={{ position: "absolute", top: 8, left: 8 }}>
                                  <DietaryBadges
                                    isVegetarian={item.isVegetarian}
                                    isVegan={item.isVegan}
                                    isGlutenFree={item.isGlutenFree}
                                    spiceLevel={item.spiceLevel}
                                    size="normal"
                                  />
                                </div>
                              </div>
                            )}
                            <div style={{ padding: 12 }}>
                              <div style={{ fontWeight: 700, fontSize: "1.15rem", color: COLORS.text }}>
                                {item.name}
                              </div>
                              {item.basePriceCents > 0 && (
                                <div style={{ color: COLORS.primary, fontSize: "1rem", marginTop: 3, fontWeight: 700 }}>
                                  ${(item.basePriceCents / 100).toFixed(2)}
                                </div>
                              )}
                            </div>
                            {/* Quantity controls overlay at bottom */}
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 12,
                              padding: "8px 12px 12px",
                              borderTop: `1px solid ${COLORS.border}`,
                            }}>
                              <button
                                onClick={() => onCartUpdate(item.id, Math.max(0, qty - 1))}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 10,
                                  border: "none",
                                  background: qty > 0 ? COLORS.primary : COLORS.border,
                                  color: qty > 0 ? COLORS.textOnPrimary : COLORS.textMuted,
                                  fontSize: "1.5rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                -
                              </button>
                              <span
                                style={{
                                  minWidth: 36,
                                  textAlign: "center",
                                  fontSize: "1.5rem",
                                  fontWeight: 700,
                                  color: COLORS.text,
                                }}
                              >
                                {qty}
                              </span>
                              <button
                                onClick={() => onCartUpdate(item.id, qty + 1, maxQty)}
                                disabled={maxQty !== undefined && qty >= maxQty}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 10,
                                  border: "none",
                                  background: maxQty !== undefined && qty >= maxQty ? COLORS.border : COLORS.primary,
                                  color: maxQty !== undefined && qty >= maxQty ? COLORS.textMuted : COLORS.textOnPrimary,
                                  fontSize: "1.5rem",
                                  fontWeight: 700,
                                  cursor: maxQty !== undefined && qty >= maxQty ? "not-allowed" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                +
                              </button>
                            </div>
                            {/* Selection indicator when qty > 0 */}
                            {qty > 0 && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: 12,
                                  right: 12,
                                  width: 72,
                                  height: 72,
                                  borderRadius: 36,
                                  background: "rgba(245, 243, 239, 0.5)",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 2,
                                }}
                              >
                                <span style={{ fontFamily: '"Ma Shan Zheng", cursive', fontSize: "2rem", color: "#C7A878", lineHeight: 1 }}>哦!</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="3">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Default style for other MULTIPLE sections (Drinks & Desserts)
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            background: qty > 0 ? COLORS.primaryLight : COLORS.surfaceElevated,
                            border: qty > 0 ? `3px solid ${COLORS.primary}` : `2px solid ${COLORS.border}`,
                            borderRadius: 12,
                            overflow: "hidden",
                            transition: "all 0.2s",
                          }}
                        >
                          {imageUrl ? (
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              <img
                                src={imageUrl}
                                alt={item.name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                              {/* Dietary badges - top left */}
                              <div style={{ position: "absolute", top: 8, left: 8 }}>
                                <DietaryBadges
                                  isVegetarian={item.isVegetarian}
                                  isVegan={item.isVegan}
                                  isGlutenFree={item.isGlutenFree}
                                  spiceLevel={item.spiceLevel}
                                  size="normal"
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                background: "#f5f5f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                position: "relative",
                              }}
                            >
                              <span style={{ fontSize: "4rem" }}>
                                {(item.name.toLowerCase().includes("drink") || item.name.toLowerCase().includes("bebida") || item.name.includes("飲") || item.name.includes("饮")) ? "🥤" :
                                 (item.name.toLowerCase().includes("tea") || item.name.toLowerCase().includes("té") || item.name.includes("茶")) ? "🍵" :
                                 (item.name.toLowerCase().includes("water") || item.name.toLowerCase().includes("agua") || item.name.includes("水")) ? "💧" : "🍽️"}
                              </span>
                              {/* Dietary badges - top left (for items without images) */}
                              <div style={{ position: "absolute", top: 8, left: 8 }}>
                                <DietaryBadges
                                  isVegetarian={item.isVegetarian}
                                  isVegan={item.isVegan}
                                  isGlutenFree={item.isGlutenFree}
                                  spiceLevel={item.spiceLevel}
                                  size="normal"
                                />
                              </div>
                            </div>
                          )}
                          <div
                            style={{
                              padding: 10,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: COLORS.text, fontSize: "1rem" }}>{item.name}</div>
                              {/* Show price for all items in drinks & dessert */}
                              {isDrinksAndDessertStep || item.basePriceCents > 0 || item.additionalPriceCents > 0 ? (
                                <div style={{ color: isDessert && isComplimentary ? COLORS.success : COLORS.primary, fontSize: "0.85rem", fontWeight: 600, marginTop: 2 }}>
                                  {isDessert && isComplimentary ? (
                                    "Complimentary - $0.00"
                                  ) : item.includedQuantity > 0 ? (
                                    <>
                                      <span style={{ color: COLORS.success }}>{item.includedQuantity} included</span>
                                      {item.additionalPriceCents > 0 && (
                                        <span style={{ color: COLORS.textMuted }}> • +${(item.additionalPriceCents / 100).toFixed(2)} each extra</span>
                                      )}
                                    </>
                                  ) : (
                                    `$${(item.basePriceCents / 100).toFixed(2)}${item.additionalPriceCents > 0 ? ` (+$${(item.additionalPriceCents / 100).toFixed(2)} each)` : ""}`
                                  )}
                                </div>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                              <button
                                onClick={() => onCartUpdate(item.id, Math.max(0, qty - 1))}
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: 12,
                                  border: "none",
                                  background: qty > 0 ? COLORS.primary : COLORS.border,
                                  color: qty > 0 ? COLORS.textOnPrimary : COLORS.textMuted,
                                  fontSize: "1.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                -
                              </button>
                              <span
                                style={{
                                  minWidth: 44,
                                  textAlign: "center",
                                  fontSize: "1.75rem",
                                  fontWeight: 700,
                                  color: COLORS.text,
                                }}
                              >
                                {qty}
                              </span>
                              <button
                              onClick={() => onCartUpdate(item.id, qty + 1, maxQty)}
                              disabled={maxQty !== undefined && qty >= maxQty}
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 12,
                                border: "none",
                                background: maxQty !== undefined && qty >= maxQty ? COLORS.border : COLORS.primary,
                                color: maxQty !== undefined && qty >= maxQty ? COLORS.textMuted : COLORS.textOnPrimary,
                                fontSize: "1.75rem",
                                fontWeight: 700,
                                cursor: maxQty !== undefined && qty >= maxQty ? "not-allowed" : "pointer",
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
                );
              })()}

              {/* Slider mode with image and "Our Suggestion" indicator */}
              {section.selectionMode === "SLIDER" && section.item && section.sliderConfig && (() => {
                const sliderName = section.name.toLowerCase();
                const itemName = section.item!.name.toLowerCase();
                const sliderValue = cart[section.item!.id] || 0;

                // Spice Level - Progressive red (English, Chinese, Spanish)
                const isSpiceSlider = sliderName.includes("spice") ||
                  section.name.includes("辣") || section.name.includes("辛") ||
                  sliderName.includes("picante");
                const spiceColors = [
                  null,
                  "rgba(244, 114, 182, 0.6)",
                  "rgba(239, 68, 68, 0.7)",
                  "rgba(220, 38, 38, 0.85)",
                  "rgba(185, 28, 28, 1)",
                ];

                // Soup Richness - Progressive deep brown (English, Chinese, Spanish)
                const isRichnessSlider = sliderName.includes("richness") || sliderName.includes("broth") ||
                  section.name.includes("濃") || section.name.includes("浓") || section.name.includes("湯") || section.name.includes("汤") ||
                  sliderName.includes("intensidad") || sliderName.includes("caldo");
                const richnessColors = [
                  "rgba(139, 90, 43, 0.4)",
                  "rgba(120, 70, 30, 0.6)",
                  "rgba(101, 55, 20, 0.85)",
                  "rgba(75, 40, 10, 1)",
                ];

                // Noodle Texture - Tan colors (English, Chinese, Spanish)
                const isTextureSlider = sliderName.includes("texture") || sliderName.includes("noodle texture") ||
                  section.name.includes("麵") || section.name.includes("面") || section.name.includes("口感") ||
                  sliderName.includes("textura") || sliderName.includes("firmeza");
                const textureColors = [
                  "rgba(139, 90, 43, 0.85)",
                  "rgba(160, 120, 70, 0.6)",
                  "rgba(180, 150, 100, 0.4)",
                ];

                // Vegetables - Deep green (English, Chinese, Spanish)
                const isVegetableSlider = ["bok choy", "green onion", "sprout", "cilantro", "pickled green",
                  "青江菜", "蔥", "葱", "芽", "香菜", "酸菜",
                  "cebollín", "germinado", "brote", "cilantro", "verdura", "soja"].some(
                  veg => itemName.includes(veg.toLowerCase()) || section.item!.name.includes(veg)
                );
                const vegetableColors = [
                  null,
                  "rgba(34, 139, 34, 0.5)",
                  "rgba(34, 139, 34, 0.7)",
                  "rgba(22, 101, 52, 0.85)",
                  "rgba(20, 83, 45, 1)",
                ];

                // Determine border color and width based on slider type
                let borderColor: string | null = null;
                let borderWidth = 2;
                let glowColor: string | null = null;
                let glowSize = 0;

                if (isSpiceSlider && sliderValue > 0) {
                  borderColor = spiceColors[sliderValue];
                  borderWidth = sliderValue === 4 ? 4 : sliderValue >= 2 ? 3 : 2;
                  if (sliderValue >= 2) {
                    glowColor = spiceColors[sliderValue];
                    glowSize = sliderValue >= 3 ? 16 : 8;
                  }
                } else if (isRichnessSlider) {
                  borderColor = richnessColors[sliderValue];
                  borderWidth = sliderValue >= 3 ? 4 : sliderValue >= 2 ? 3 : 2;
                  if (sliderValue >= 2) {
                    glowColor = richnessColors[sliderValue];
                    glowSize = sliderValue >= 3 ? 12 : 6;
                  }
                } else if (isTextureSlider) {
                  borderColor = textureColors[sliderValue];
                  borderWidth = sliderValue === 0 ? 3 : 2;
                  if (sliderValue === 0) {
                    glowColor = textureColors[0];
                    glowSize = 8;
                  }
                } else if (isVegetableSlider && sliderValue > 0) {
                  borderColor = vegetableColors[sliderValue];
                  borderWidth = sliderValue >= 3 ? 3 : 2;
                  if (sliderValue >= 2) {
                    glowColor = vegetableColors[sliderValue];
                    glowSize = sliderValue >= 3 ? 10 : 5;
                  }
                }

                return (
                <div
                  style={{
                    background: COLORS.surfaceElevated,
                    borderRadius: 12,
                    border: borderColor
                      ? `${borderWidth}px solid ${borderColor}`
                      : `2px solid ${COLORS.border}`,
                    boxShadow: glowColor && glowSize > 0
                      ? `0 0 ${glowSize}px ${glowColor}`
                      : undefined,
                    display: "flex",
                    overflow: "hidden",
                    transition: "all 0.3s ease",
                  }}
                >
                  {/* Image on left */}
                  {(MENU_IMAGES[section.item.nameEn || section.item.name] || MENU_IMAGES[section.item.name]) && (
                    <div
                      style={{
                        width: 100,
                        minHeight: 120,
                        flexShrink: 0,
                        background: "#f5f5f5",
                        position: "relative",
                      }}
                    >
                      <img
                        src={MENU_IMAGES[section.item.nameEn || section.item.name] || MENU_IMAGES[section.item.name]}
                        alt={section.item.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          position: "absolute",
                          top: 0,
                          left: 0,
                        }}
                      />
                    </div>
                  )}

                  {/* Content on right */}
                  <div style={{ flex: 1, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>{section.item.name}</span>
                      <DietaryBadges
                        isVegetarian={section.item.isVegetarian}
                        isVegan={section.item.isVegan}
                        isGlutenFree={section.item.isGlutenFree}
                        spiceLevel={section.item.spiceLevel}
                        size="small"
                      />
                    </div>

                    {/* Slider with padding to keep labels within bounds */}
                    <div style={{ position: "relative", paddingTop: 8, paddingLeft: 40, paddingRight: 40 }}>
                      <input
                        type="range"
                        className="kiosk-slider"
                        min={section.sliderConfig.min || 0}
                        max={section.sliderConfig.max || 3}
                        value={cart[section.item.id] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          const labels = section.sliderConfig.labels || [];
                          handleSliderChange(section.item!.id, val, labels, section.sliderConfig.default ?? 0);
                        }}
                        style={{
                          width: "100%",
                          height: 10,
                          cursor: "pointer",
                        }}
                      />
                    </div>

                    {/* Labels below slider - using flexbox for even distribution */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 14,
                        fontSize: "1rem",
                        paddingLeft: 40,
                        paddingRight: 40,
                      }}
                    >
                      {section.sliderConfig.labels?.map((label: string, i: number) => {
                        const isDefault = i === (section.sliderConfig.default ?? 0);
                        const isSelected = cart[section.item!.id] === i;
                        return (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <span
                              style={{
                                color: isSelected ? COLORS.primary : COLORS.text,
                                fontWeight: isSelected ? 700 : 500,
                                fontSize: isSelected ? "1.1rem" : "1rem",
                                transition: "all 0.2s",
                                padding: isDefault ? "4px 10px" : undefined,
                                border: isDefault ? `2px dashed ${COLORS.primary}` : undefined,
                                borderRadius: isDefault ? 8 : undefined,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {translateSliderLabel(label)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          ))}
              </>
            );
          })()}
        </div>
      </div>

      {/* Scroll Hint - Prominent animated indicator */}
      {showScrollHint && (
        <div
          style={{
            position: "fixed",
            bottom: 180,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            zIndex: 15,
            animation: "scrollHintPulse 2s ease-in-out infinite",
          }}
        >
          {/* Animated chevrons on left - pointing down */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite", opacity: 0.9 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.15s", marginTop: -6, opacity: 0.6 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.3s", marginTop: -6, opacity: 0.3 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
          </div>

          <div
            style={{
              background: COLORS.primaryDark,
              color: COLORS.textOnPrimary,
              padding: "12px 28px",
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            <span>{tKiosk("orderFlow.scrollForMore")}</span>
          </div>

          {/* Animated chevrons on right - pointing down */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite", opacity: 0.9 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.15s", marginTop: -6, opacity: 0.6 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg
              width="32"
              height="16"
              viewBox="0 0 24 12"
              fill="none"
              stroke={COLORS.primaryDark}
              strokeWidth="3"
              style={{ animation: "chevronBounce 1s ease-in-out infinite 0.3s", marginTop: -6, opacity: 0.3 }}
            >
              <path d="M4 2l8 8 8-8" />
            </svg>
          </div>
        </div>
      )}

      {/* Fixed Navigation with Running Total */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 20px 16px",
          background: COLORS.primaryLight,
          borderTop: `1px solid ${COLORS.primaryBorder}`,
          zIndex: 10,
        }}
      >
        {/* Running Total and Allergen Info row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 16,
            position: "relative",
          }}
        >
          <div
            style={{
              background: COLORS.surface,
              padding: "12px 28px",
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${COLORS.primaryBorder}`,
            }}
          >
            <span style={{ color: COLORS.textMuted, fontSize: "1.15rem", fontWeight: 500 }}>{t("builder.subtotalLabel")}</span>
            <span style={{ color: COLORS.primary, fontWeight: 700, fontSize: "1.5rem" }}>
              ${(runningTotal / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Allergen Info Link - positioned toward right, vertically centered */}
        <button
          onClick={() => setShowAllergenPopup(true)}
          style={{
            position: "absolute",
            right: 100,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            color: COLORS.primary,
            fontSize: "1.35rem",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          ⚠️ {tKiosk("orderFlow.ohAllergenInfo")}
        </button>

        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          {/* Cancel button on step 1, Back button on other steps */}
          {!canGoBack ? (
            <button
              onClick={onCancel}
              style={{
                padding: "18px 40px",
                background: COLORS.primary,
                border: "none",
                borderRadius: 12,
                color: COLORS.textOnPrimary,
                fontSize: "1.2rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {tCommon("cancel")}
            </button>
          ) : (
            <button
              onClick={onPrevious}
              style={{
                padding: "18px 40px",
                background: "transparent",
                border: `2px solid ${COLORS.border}`,
                borderRadius: 12,
                color: COLORS.textMuted,
                fontSize: "1.2rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {tCommon("back")}
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!canProceed}
            style={{
              padding: "18px 56px",
              background: canProceed ? COLORS.primary : "#ccc",
              border: "none",
              borderRadius: 12,
              color: canProceed ? COLORS.textOnPrimary : "#888",
              fontSize: "1.2rem",
              fontWeight: 700,
              cursor: canProceed ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {stepIndex === totalSteps - 1 ? tKiosk("orderFlow.reviewOrder") : tCommon("next")}
            <span style={{
              display: "inline-block",
              animation: canProceed ? "chevronBounceHorizontal 1s ease-in-out infinite" : "none",
            }}>
              →
            </span>
          </button>
        </div>
      </div>

      {/* Allergen Info Popup */}
      {showAllergenPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowAllergenPopup(false)}
        >
          <div
            style={{
              background: COLORS.surface,
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: "90%",
              position: "relative",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - large for kiosk touch */}
            <button
              onClick={() => setShowAllergenPopup(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 56,
                height: 56,
                borderRadius: 28,
                border: `2px solid ${COLORS.border}`,
                background: COLORS.surfaceElevated,
                color: COLORS.text,
                fontSize: "2rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>

            {/* Header with Oh! branding */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <img
                src="/Oh_Logo_Mark_Web.png"
                alt="Oh!"
                style={{ width: 48, height: 48, objectFit: "contain" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "1.3rem" }}>⚠️</span>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: COLORS.text, margin: 0 }}>
                  {tKiosk("orderFlow.ohAllergenInformation")}
                </h2>
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: "1rem", color: COLORS.textLight, lineHeight: 1.6, marginBottom: 24 }}>
              {tKiosk("orderFlow.allergenDisclaimer")}
            </p>

            {/* Legend */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: COLORS.text, marginBottom: 16 }}>
              {tKiosk("orderFlow.dietarySymbolLegend")}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src="/allergens/vegetarian.png" alt={tKiosk("orderFlow.vegetarian")} style={{ width: 32, height: 32, objectFit: "contain" }} />
                <span style={{ fontSize: "1rem", color: COLORS.text }}>{tKiosk("orderFlow.vegetarian")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src="/allergens/vegan.png" alt={tKiosk("orderFlow.vegan")} style={{ width: 32, height: 32, objectFit: "contain" }} />
                <span style={{ fontSize: "1rem", color: COLORS.text }}>{tKiosk("orderFlow.vegan")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src="/allergens/gluten-free.png" alt={tKiosk("orderFlow.glutenFree")} style={{ width: 32, height: 32, objectFit: "contain" }} />
                <span style={{ fontSize: "1rem", color: COLORS.text }}>{tKiosk("orderFlow.glutenFree")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "4px 10px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  borderRadius: 6,
                  background: "#fecaca",
                  color: "#dc2626",
                }}>
                  🌶️🌶️🌶️
                </span>
                <span style={{ fontSize: "1rem", color: COLORS.text }}>{tKiosk("orderFlow.spicyDescription")}</span>
              </div>
            </div>

            {/* Footer note */}
            <p style={{ fontSize: "0.85rem", color: COLORS.textMuted, fontStyle: "italic", marginTop: 20, textAlign: "center" }}>
              {tKiosk("orderFlow.allergenInfoDetail")}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-8px); }
        }
        @keyframes scrollHintPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(1.03); opacity: 0.95; }
        }
        @keyframes chevronBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @keyframes chevronBounceHorizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        ${sliderThumbStyles}
      `}</style>
    </main>
  );
}

function ReviewView({
  guestName,
  guestNumber,
  totalGuests,
  cart,
  sliderLabels,
  selections,
  menuSteps,
  taxRate,
  onSubmit,
  onBack,
  submitting,
}: {
  guestName: string;
  guestNumber: number;
  totalGuests: number;
  cart: Record<string, number>;
  sliderLabels: Record<string, string>;
  selections: Record<string, string>;
  menuSteps: MenuStep[];
  taxRate: number;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const tKiosk = useTranslations("kiosk");
  const tOrder = useTranslations("order");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Helper to translate slider labels
  const translateSliderLabel = (label: string): string => {
    // Try to get the translation from order.builder.sliderLabels
    try {
      const key = `builder.sliderLabels.${label}` as any;
      const translated = tOrder(key);
      // If translation exists and is different from key, use it
      if (translated && translated !== key) {
        return translated;
      }
    } catch {
      // Fall through to return original
    }
    return label;
  };

  // Check if there's content below the fold
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const hasOverflow = container.scrollHeight > container.clientHeight + 10;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
      setShowScrollHint(hasOverflow && !isNearBottom);
    }
  }, []);

  // Stop auto-scroll
  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    setIsAutoScrolling(false);
  }, []);

  // Auto-scroll slowly until bottom - Safari compatible
  useEffect(() => {
    let startTimeout: NodeJS.Timeout | null = null;

    const startAutoScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Check if there's content to scroll
      const hasOverflow = container.scrollHeight > container.clientHeight + 10;
      if (!hasOverflow) {
        console.log('[AutoScroll] No overflow, skipping');
        return;
      }

      console.log('[AutoScroll] Starting auto-scroll');
      setIsAutoScrolling(true);

      // Use setInterval for better Safari compatibility
      scrollIntervalRef.current = setInterval(() => {
        const cont = scrollContainerRef.current;
        if (!cont) {
          stopAutoScroll();
          return;
        }

        const isAtBottom = cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 5;

        if (!isAtBottom) {
          cont.scrollTop += 1; // Scroll 1px every 16ms (~60fps)
        } else {
          // Reached bottom, stop scrolling
          console.log('[AutoScroll] Reached bottom');
          stopAutoScroll();
        }
      }, 16);
    };

    // Start after a delay to let content render
    startTimeout = setTimeout(() => {
      checkScrollPosition();
      startAutoScroll();
    }, 2500);

    // Cleanup
    return () => {
      if (startTimeout) clearTimeout(startTimeout);
      stopAutoScroll();
    };
  }, [checkScrollPosition, stopAutoScroll]);

  // Only stop auto-scroll on actual user touch/interaction, not programmatic scroll
  const handleUserTouch = useCallback(() => {
    if (isAutoScrolling) {
      console.log('[AutoScroll] User touch, stopping');
      stopAutoScroll();
    }
  }, [stopAutoScroll, isAutoScrolling]);

  // Update scroll hint on scroll (don't stop auto-scroll here)
  const handleScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  // Categorize items for display
  const bowlItems: Array<{ name: string; price: number; image?: string; value?: string }> = [];
  const customizations: Array<{ name: string; value: string }> = [];
  const addOnItems: Array<{ name: string; quantity: number; price: number; image?: string }> = [];
  const drinkItems: Array<{ name: string; quantity: number; price: number; image?: string }> = [];
  const dessertItems: Array<{ name: string; quantity: number; price: number; image?: string }> = [];

  // Multi-language detection helpers for order review
  const isBowlSection = (stepTitle: string, sectionName: string) => {
    const stepLower = stepTitle.toLowerCase();
    const sectionLower = sectionName.toLowerCase();
    // English
    if (stepLower.includes("foundation") || sectionLower.includes("bowl") ||
        sectionLower.includes("base") || sectionLower.includes("soup") || sectionLower.includes("broth")) return true;
    // Spanish
    if (sectionLower.includes("sopa") || sectionLower.includes("caldo") || stepLower.includes("base")) return true;
    // Chinese
    if (stepTitle.includes("湯") || stepTitle.includes("汤") || sectionName.includes("湯") || sectionName.includes("汤") ||
        sectionName.includes("碗") || stepTitle.includes("基") || sectionName.includes("底")) return true;
    return false;
  };

  const isNoodleSection = (sectionName: string) => {
    const sectionLower = sectionName.toLowerCase();
    // English
    if (sectionLower.includes("noodle")) return true;
    // Spanish
    if (sectionLower.includes("fideo") || sectionLower.includes("pasta")) return true;
    // Chinese
    if (sectionName.includes("麵") || sectionName.includes("面")) return true;
    return false;
  };

  menuSteps.forEach((step) => {
    step.sections.forEach((section) => {
      if (section.selectionMode === "SINGLE" && selections[section.id]) {
        const selectedItem = section.items?.find((i) => i.id === selections[section.id]);
        if (selectedItem) {
          // Check if it's a bowl/base or noodle selection (multi-language)
          if (isBowlSection(step.title, section.name)) {
            bowlItems.push({
              name: selectedItem.name,
              price: selectedItem.basePriceCents,
              image: MENU_IMAGES[selectedItem.nameEn || selectedItem.name] || MENU_IMAGES[selectedItem.name],
            });
          } else if (isNoodleSection(section.name)) {
            bowlItems.push({
              name: selectedItem.name,
              price: 0,
              image: MENU_IMAGES[selectedItem.nameEn || selectedItem.name] || MENU_IMAGES[selectedItem.name],
            });
          }
        }
      } else if (section.selectionMode === "SLIDER" && section.item) {
        const label = sliderLabels[section.item.id];
        if (label) {
          customizations.push({ name: section.item.name, value: label });
        }
      } else if (section.selectionMode === "MULTIPLE" && section.items) {
        section.items.forEach((item) => {
          const qty = cart[item.id];
          if (qty && qty > 0) {
            const price = calculateItemPrice(item, qty);
            const itemData = {
              name: item.name,
              quantity: qty,
              price,
              image: MENU_IMAGES[item.nameEn || item.name] || MENU_IMAGES[item.name],
            };

            // Categorize by type (multi-language)
            const sectionLower = section.name.toLowerCase();
            const isDessertItem = item.category?.toLowerCase() === "dessert" ||
              sectionLower.includes("dessert") || sectionLower.includes("postre") ||
              section.name.includes("甜") || section.name.includes("點心") || section.name.includes("点心");
            const isDrinkItem = item.category?.toLowerCase() === "drink" ||
              sectionLower.includes("drink") || sectionLower.includes("beverage") || sectionLower.includes("bebida") ||
              section.name.includes("飲") || section.name.includes("饮") || section.name.includes("飲料") || section.name.includes("饮料");

            if (isDessertItem) {
              dessertItems.push(itemData);
            } else if (isDrinkItem) {
              drinkItems.push(itemData);
            } else {
              addOnItems.push(itemData);
            }
          }
        });
      }
    });
  });

  // Calculate subtotals
  const bowlSubtotal = bowlItems.reduce((sum, item) => sum + item.price, 0);
  const addOnsSubtotal = addOnItems.reduce((sum, item) => sum + item.price, 0);
  const drinksSubtotal = drinkItems.reduce((sum, item) => sum + item.price, 0);
  const dessertSubtotal = dessertItems.reduce((sum, item) => sum + item.price, 0);
  const subtotal = bowlSubtotal + addOnsSubtotal + drinksSubtotal + dessertSubtotal;
  const taxCents = Math.round(subtotal * taxRate);
  const orderTotal = subtotal + taxCents;

  return (
    <main
      style={{
        height: "100vh",
        maxHeight: "100vh",
        background: COLORS.surface,
        color: COLORS.text,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%",
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Large Brand Header - top left (matching NameEntryView) */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Fixed Header with color */}
      <div style={{
        textAlign: "center",
        paddingTop: 32,
        paddingBottom: 20,
        background: COLORS.primaryLight,
        borderBottom: `1px solid ${COLORS.primaryBorder}`,
        zIndex: 1,
      }}>
        <div style={{ fontSize: "1.5rem", color: COLORS.textMuted, marginBottom: 8 }}>
          {tKiosk("orderFlow.guestOf", { current: guestNumber, total: totalGuests })}
        </div>
        <h1 className="kiosk-title" style={{ fontSize: "3.5rem", fontWeight: 700, marginBottom: 8 }}>
          {guestName}
        </h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>{tKiosk("orderFlow.reviewBeforeSubmitting")}</p>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onTouchStart={handleUserTouch}
        onMouseDown={handleUserTouch}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px",
          paddingBottom: 140,
          WebkitOverflowScrolling: "touch",
        }}
      >
      <div style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
        {/* Bowl Configuration Section - Compact */}
        {(bowlItems.length > 0 || customizations.length > 0) && (
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 10,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8, color: COLORS.primary }}>
              {tKiosk("orderFlow.bowlConfiguration")}
            </h3>

            {/* Bowl selections - compact rows */}
            {bowlItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 0",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.1rem" }}>🍜</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{item.name}</span>
                </div>
                <span style={{ color: COLORS.primary, fontWeight: 600, fontSize: "0.95rem" }}>
                  {item.price > 0 ? `$${(item.price / 100).toFixed(2)}` : tKiosk("orderFlow.included")}
                </span>
              </div>
            ))}

            {/* Customizations (sliders) - inline compact */}
            {customizations.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 6 }}>
                {customizations.map((item, i) => (
                  <span key={`custom-${i}`} style={{ fontSize: "0.85rem", color: COLORS.textLight }}>
                    {item.name}: <span style={{ color: COLORS.textMuted, fontWeight: 500 }}>{translateSliderLabel(item.value)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Bowl subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 6, borderTop: `1px dashed ${COLORS.border}` }}>
              <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{tKiosk("orderFlow.bowlSubtotal")}</span>
              <span style={{ fontWeight: 600, color: COLORS.primary, fontSize: "0.95rem" }}>${(bowlSubtotal / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Extras Section - Combined Add-Ons, Sides, Drinks, Dessert */}
        {(addOnItems.length > 0 || drinkItems.length > 0 || dessertItems.length > 0) && (
          <div
            style={{
              background: COLORS.surfaceElevated,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 10,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8, color: COLORS.primary }}>
              {tKiosk("orderFlow.extras")}
            </h3>

            {/* Add-Ons & Sides */}
            {addOnItems.map((item, i) => (
              <div
                key={`addon-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 0",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.1rem" }}>🍽️</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}> x{item.quantity}</span>}
                </div>
                <span style={{ color: COLORS.primary, fontWeight: 600, fontSize: "0.95rem" }}>
                  {item.price > 0 ? `$${(item.price / 100).toFixed(2)}` : tKiosk("orderFlow.included")}
                </span>
              </div>
            ))}

            {/* Drinks */}
            {drinkItems.map((item, i) => (
              <div
                key={`drink-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 0",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.1rem" }}>🥤</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}> x{item.quantity}</span>}
                </div>
                <span style={{ color: COLORS.primary, fontWeight: 600, fontSize: "0.95rem" }}>
                  {item.price > 0 ? `$${(item.price / 100).toFixed(2)}` : tKiosk("orderFlow.free")}
                </span>
              </div>
            ))}

            {/* Desserts */}
            {dessertItems.map((item, i) => (
              <div
                key={`dessert-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 0",
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "1.1rem" }}>🍨</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}> x{item.quantity}</span>}
                </div>
                <span style={{ color: item.price === 0 ? COLORS.success : COLORS.primary, fontWeight: 600, fontSize: "0.95rem" }}>
                  {item.price === 0 ? tKiosk("orderFlow.free") : `$${(item.price / 100).toFixed(2)}`}
                </span>
              </div>
            ))}

            {/* Extras subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 6, borderTop: `1px dashed ${COLORS.border}` }}>
              <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{tKiosk("orderFlow.extrasSubtotal")}</span>
              <span style={{ fontWeight: 600, color: COLORS.primary, fontSize: "0.95rem" }}>${((addOnsSubtotal + drinksSubtotal + dessertSubtotal) / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Order Total with Tax */}
        <div
          style={{
            background: COLORS.primary,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          {/* Subtotal */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: COLORS.textOnPrimary, fontSize: "0.9rem", opacity: 0.9 }}>{tKiosk("orderFlow.subtotal")}</span>
            <span style={{ color: COLORS.textOnPrimary, fontSize: "0.9rem" }}>
              ${(subtotal / 100).toFixed(2)}
            </span>
          </div>
          {/* Tax */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
            <span style={{ color: COLORS.textOnPrimary, fontSize: "0.9rem", opacity: 0.9 }}>
              {tKiosk("orderFlow.tax")} ({(taxRate * 100).toFixed(2)}%)
            </span>
            <span style={{ color: COLORS.textOnPrimary, fontSize: "0.9rem" }}>
              ${(taxCents / 100).toFixed(2)}
            </span>
          </div>
          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: COLORS.textOnPrimary, fontSize: "1rem", fontWeight: 600 }}>{tKiosk("orderFlow.total")}</span>
            <span style={{ color: COLORS.textOnPrimary, fontSize: "1.25rem", fontWeight: 700 }}>
              ${(orderTotal / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* Scroll Hint Indicator */}
      {showScrollHint && (
        <div
          style={{
            position: "fixed",
            bottom: 140,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            zIndex: 15,
            animation: "scrollHintPulse 2s ease-in-out infinite",
          }}
        >
          {/* Animated chevrons on left */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <svg width="28" height="14" viewBox="0 0 24 12" fill="none" stroke={COLORS.primaryDark} strokeWidth="3" style={{ animation: "chevronBounce 1s ease-in-out infinite", opacity: 0.9 }}>
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg width="28" height="14" viewBox="0 0 24 12" fill="none" stroke={COLORS.primaryDark} strokeWidth="3" style={{ animation: "chevronBounce 1s ease-in-out infinite 0.15s", marginTop: -4, opacity: 0.6 }}>
              <path d="M4 2l8 8 8-8" />
            </svg>
          </div>

          <div
            style={{
              background: COLORS.primaryDark,
              color: COLORS.textOnPrimary,
              padding: "10px 24px",
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            <span>{tKiosk("orderFlow.scrollToSeeMore")}</span>
          </div>

          {/* Animated chevrons on right */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <svg width="28" height="14" viewBox="0 0 24 12" fill="none" stroke={COLORS.primaryDark} strokeWidth="3" style={{ animation: "chevronBounce 1s ease-in-out infinite", opacity: 0.9 }}>
              <path d="M4 2l8 8 8-8" />
            </svg>
            <svg width="28" height="14" viewBox="0 0 24 12" fill="none" stroke={COLORS.primaryDark} strokeWidth="3" style={{ animation: "chevronBounce 1s ease-in-out infinite 0.15s", marginTop: -4, opacity: 0.6 }}>
              <path d="M4 2l8 8 8-8" />
            </svg>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation with color */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          background: COLORS.primaryLight,
          borderTop: `1px solid ${COLORS.primaryBorder}`,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          disabled={submitting}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          {tKiosk("orderFlow.editOrder")}
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: "16px 48px",
            background: submitting ? "#ccc" : COLORS.primary,
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <strong>{submitting ? tKiosk("orderFlow.submitting") : tKiosk("orderFlow.continueToPodSelection")}</strong>
          {!submitting && (
            <span style={{
              display: "inline-block",
              animation: "chevronBounceHorizontal 1s ease-in-out infinite",
            }}>
              →
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes chevronBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        @keyframes chevronBounceHorizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        @keyframes scrollHintPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </main>
  );
}

function PodSelectionView({
  seats,
  guestOrders,
  currentGuestIndex,
  partySize,
  paymentType,
  selectedPodId,
  onSelectPod,
  onConfirm,
  onBack,
}: {
  seats: Seat[];
  guestOrders: GuestOrder[];
  currentGuestIndex: number;
  partySize: number;
  paymentType: "single" | "separate";
  selectedPodId?: string;
  onSelectPod: (podId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const tKiosk = useTranslations("kiosk");

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Get pods already selected by other guests in this party
  const takenPodIds = guestOrders
    .filter((_, i) => i !== currentGuestIndex)
    .map((g) => g.selectedPodId)
    .filter(Boolean) as string[];

  // Dual pods can only be selected if:
  // 1. Party size is 2 or more AND
  // 2. Host is paying for all orders (single payment, not separate)
  const canSelectDualPod = partySize >= 2 && paymentType === "single";

  // Helper to check if a seat is part of a dual pod
  const isDualPodSeat = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return true;
    return seats.some(s => s.dualPartnerId === seat.id);
  };

  // Recommend pods based on availability and party size
  // Only recommend dual pods if they can be selected
  const availableSeats = seats.filter(
    (s) => s.status === "AVAILABLE" && !takenPodIds.includes(s.id) && (!isDualPodSeat(s) || canSelectDualPod)
  );

  // Recommend the first few available pods
  const recommendedPods = availableSeats.slice(0, Math.min(3, availableSeats.length));

  const selectedSeat = seats.find((s) => s.id === selectedPodId);

  // Group seats by side for U-shape layout
  // Left: top to bottom (col ascending)
  // Bottom: left to right (col ascending)
  // Right: bottom to top (col descending) - to continue the U-shape flow
  const leftSeats = seats.filter((s) => s.side === "left").sort((a, b) => a.col - b.col);
  const bottomSeats = seats.filter((s) => s.side === "bottom").sort((a, b) => a.col - b.col);
  const rightSeats = seats.filter((s) => s.side === "right").sort((a, b) => b.col - a.col);

  // Helper to check if a seat is part of a dual pod
  const isDualPod = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return true;
    return seats.some(s => s.dualPartnerId === seat.id);
  };

  // Helper to get partner seat
  const getPartner = (seat: Seat) => {
    if (seat.dualPartnerId) {
      return seats.find(s => s.id === seat.dualPartnerId);
    }
    return seats.find(s => s.dualPartnerId === seat.id);
  };

  // Check if a seat should be hidden (it's the secondary seat of a dual pod pair)
  const shouldHideSeat = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return false;
    return seats.some(s => s.dualPartnerId === seat.id);
  };

  return (
    <main
      style={{
        height: "100vh",
        maxHeight: "100vh",
        background: COLORS.surface,
        color: COLORS.text,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%",
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Large Brand Header - top left */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Fixed Header with color */}
      <div style={{
        textAlign: "center",
        paddingTop: 32,
        paddingBottom: 20,
        background: COLORS.primaryLight,
        borderBottom: `1px solid ${COLORS.primaryBorder}`,
        zIndex: 1,
      }}>
        {partySize > 1 && (
          <div style={{ fontSize: "1.5rem", color: COLORS.textMuted, marginBottom: 8 }}>
            {tKiosk("orderFlow.guestOf", { current: currentGuestIndex + 1, total: partySize })}
          </div>
        )}
        <h1 className="kiosk-title" style={{ fontSize: "3.5rem", fontWeight: 700, marginBottom: 8 }}>
          {tKiosk("orderFlow.chooseYourPod")}
        </h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>
          <strong style={{ color: COLORS.text }}>{guestOrders[currentGuestIndex].guestName}</strong>, {tKiosk("orderFlow.pickPrivatePod")}
        </p>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 48px",
        paddingBottom: 120,
      }}>

      {/* Recommended Pods */}
      {recommendedPods.length > 0 && !selectedPodId && (
        <div
          style={{
            background: COLORS.successLight,
            border: `2px solid ${COLORS.success}`,
            borderRadius: 16,
            padding: 20,
            marginBottom: 32,
            textAlign: "center",
            maxWidth: 500,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, color: COLORS.success }}>
            {tKiosk("orderFlow.weRecommendPod", { number: recommendedPods[0].number })}
          </div>
          <button
            onClick={() => onSelectPod(recommendedPods[0].id)}
            style={{
              padding: "12px 32px",
              background: COLORS.success,
              border: "none",
              borderRadius: 10,
              color: COLORS.textOnPrimary,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tKiosk("orderFlow.acceptRecommendation")}
          </button>
        </div>
      )}

      {/* Pod Map - U-Shape Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Entrance Label at top */}
        <div style={{ color: COLORS.textMuted, fontSize: "1.1rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🚪</span> {tKiosk("orderFlow.entrance")}
        </div>

        {/* U-Shape Container: Left Column | Kitchen | Right Column */}
        <div style={{ display: "flex", gap: 32, alignItems: "stretch" }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {leftSeats.filter(seat => !shouldHideSeat(seat)).map((seat) => {
              const isDual = isDualPod(seat);
              const partner = isDual ? getPartner(seat) : null;
              const isSelectedDual = isDual && partner && (selectedPodId === seat.id || selectedPodId === partner.id);
              return (
                <PodButton
                  key={seat.id}
                  seat={seat}
                  partner={partner}
                  isDual={isDual}
                  isSelected={selectedPodId === seat.id || isSelectedDual}
                  isTaken={takenPodIds.includes(seat.id) || (partner ? takenPodIds.includes(partner.id) : false)}
                  isRecommended={recommendedPods.some((r) => r.id === seat.id || (partner && r.id === partner.id))}
                  canSelectDualPod={canSelectDualPod}
                  onClick={() => onSelectPod(seat.id)}
                  orientation="vertical"
                />
              );
            })}
          </div>

          {/* Kitchen in the center */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 48px",
            minHeight: 200,
          }}>
            <span style={{ fontSize: "4rem", marginBottom: 8 }}>👨‍🍳</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 600, color: COLORS.textMuted }}>{tKiosk("orderFlow.kitchen")}</span>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {rightSeats.filter(seat => !shouldHideSeat(seat)).map((seat) => {
              const isDual = isDualPod(seat);
              const partner = isDual ? getPartner(seat) : null;
              const isSelectedDual = isDual && partner && (selectedPodId === seat.id || selectedPodId === partner.id);
              return (
                <PodButton
                  key={seat.id}
                  seat={seat}
                  partner={partner}
                  isDual={isDual}
                  isSelected={selectedPodId === seat.id || isSelectedDual}
                  isTaken={takenPodIds.includes(seat.id) || (partner ? takenPodIds.includes(partner.id) : false)}
                  isRecommended={recommendedPods.some((r) => r.id === seat.id || (partner && r.id === partner.id))}
                  canSelectDualPod={canSelectDualPod}
                  onClick={() => onSelectPod(seat.id)}
                  orientation="vertical"
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Row - below the U-shape */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 8,
          }}
        >
          {bottomSeats.filter(seat => !shouldHideSeat(seat)).map((seat) => {
            const isDual = isDualPod(seat);
            const partner = isDual ? getPartner(seat) : null;
            const isSelectedDual = isDual && partner && (selectedPodId === seat.id || selectedPodId === partner.id);
            return (
              <PodButton
                key={seat.id}
                seat={seat}
                partner={partner}
                isDual={isDual}
                isSelected={selectedPodId === seat.id || isSelectedDual}
                isTaken={takenPodIds.includes(seat.id) || (partner ? takenPodIds.includes(partner.id) : false)}
                isRecommended={recommendedPods.some((r) => r.id === seat.id || (partner && r.id === partner.id))}
                canSelectDualPod={canSelectDualPod}
                onClick={() => onSelectPod(seat.id)}
                orientation="horizontal"
              />
            );
          })}
        </div>

        {/* Exit Label at bottom */}
        <div style={{ color: COLORS.textMuted, fontSize: "1.1rem", marginTop: 8 }}>
          {tKiosk("orderFlow.exit")}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: COLORS.success }} />
          <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{tKiosk("orderFlow.available")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 56, borderRadius: 6, background: "#22d3ee" }} />
          <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{tKiosk("orderFlow.dualPod")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#ef4444" }} />
          <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{tKiosk("orderFlow.occupied")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: COLORS.primary, border: `3px solid ${COLORS.text}` }} />
          <span style={{ fontSize: "1rem", color: COLORS.textMuted }}>{tKiosk("orderFlow.yourSelection")}</span>
        </div>
      </div>

      {/* Selected Pod Info */}
      {selectedSeat && (
        <div
          style={{
            background: COLORS.primaryLight,
            border: `2px solid ${COLORS.primary}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            {(() => {
              const isDual = isDualPod(selectedSeat);
              if (isDual) {
                const partner = getPartner(selectedSeat);
                if (partner) {
                  const num1 = parseInt(selectedSeat.number);
                  const num2 = parseInt(partner.number);
                  return tKiosk("pod.dualPodSelected", { numbers: `${Math.min(num1, num2).toString().padStart(2, '0')} & ${Math.max(num1, num2).toString().padStart(2, '0')}` });
                }
              }
              return tKiosk("pod.podSelected", { number: selectedSeat.number });
            })()}
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}>
            {isDualPod(selectedSeat) ? tKiosk("pod.dualPod") : tKiosk("pod.singlePod")}
          </div>
        </div>
      )}
      </div>

      {/* Fixed Bottom Navigation with color */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          background: COLORS.primaryLight,
          borderTop: `1px solid ${COLORS.primaryBorder}`,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          {tKiosk("orderFlow.back")}
        </button>
        <button
          onClick={onConfirm}
          disabled={!selectedPodId}
          style={{
            padding: "16px 48px",
            background: selectedPodId ? COLORS.primary : "#ccc",
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: selectedPodId ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <strong>{tKiosk("orderFlow.continueToPayment")}</strong>
          {selectedPodId && (
            <span style={{
              display: "inline-block",
              animation: "chevronBounceHorizontal 1s ease-in-out infinite",
            }}>
              →
            </span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes chevronBounceHorizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}

function PodButton({
  seat,
  partner,
  isDual,
  isSelected,
  isTaken,
  isRecommended,
  canSelectDualPod = true,
  onClick,
  orientation = "vertical",
}: {
  seat: Seat;
  partner?: Seat | null;
  isDual?: boolean;
  isSelected: boolean;
  isTaken: boolean;
  isRecommended: boolean;
  canSelectDualPod?: boolean;
  onClick: () => void;
  orientation?: "vertical" | "horizontal";
}) {
  const partnerAvailable = partner ? partner.status === "AVAILABLE" : true;
  // For dual pods, also check if dual pods can be selected (requires 2+ guests with single payment)
  const isAvailable = seat.status === "AVAILABLE" && partnerAvailable && !isTaken && (!isDual || canSelectDualPod);

  // Dual pods use cyan/teal color, single pods use green
  // If dual pod is not selectable due to party size/payment, use dimmed cyan
  const bgColor = isSelected
    ? COLORS.primary
    : !isAvailable && isDual && !canSelectDualPod
    ? "#a5f3fc" // cyan-200 - dimmed cyan for unavailable dual pods
    : !isAvailable
    ? "#ef4444"
    : isDual
    ? "#22d3ee" // cyan-400 for dual pods
    : COLORS.success;

  // Non-recommended available pods get reduced opacity (but still visible)
  const opacity = isSelected || !isAvailable || isRecommended ? 1 : 0.45;

  // For dual pods, make the button larger (double in one direction)
  // Sizes reduced by ~10% for better fit
  const isHorizontal = orientation === "horizontal";
  const width = isDual ? (isHorizontal ? 152 : 76) : 76;
  const height = isDual ? (isHorizontal ? 76 : 152) : 76;

  // Get display numbers for dual pods
  const getDisplayNumbers = () => {
    if (!isDual || !partner) return null;
    const num1 = parseInt(seat.number);
    const num2 = parseInt(partner.number);
    // For vertical: lower number on top for left side, higher on top for right side
    // For horizontal: lower number on left
    if (isHorizontal) {
      return {
        first: Math.min(num1, num2).toString().padStart(2, '0'),
        second: Math.max(num1, num2).toString().padStart(2, '0'),
      };
    } else {
      // Vertical - for right side, higher numbers on top; for left side, lower on top
      // We determine side by checking if this seat is on the right
      const isRightSide = seat.side === "right";
      if (isRightSide) {
        return {
          first: Math.max(num1, num2).toString().padStart(2, '0'),
          second: Math.min(num1, num2).toString().padStart(2, '0'),
        };
      } else {
        return {
          first: Math.min(num1, num2).toString().padStart(2, '0'),
          second: Math.max(num1, num2).toString().padStart(2, '0'),
        };
      }
    }
  };

  const dualNumbers = getDisplayNumbers();

  return (
    <button
      onClick={onClick}
      disabled={!isAvailable}
      style={{
        width,
        height,
        borderRadius: 16,
        border: isSelected ? `4px solid ${COLORS.text}` : "none",
        background: bgColor,
        color: isAvailable ? COLORS.textOnPrimary : "rgba(255,255,255,0.7)",
        fontSize: "1.35rem",
        fontWeight: 700,
        cursor: isAvailable ? "pointer" : "not-allowed",
        display: "flex",
        flexDirection: isHorizontal ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isDual ? 8 : 0,
        transition: "all 0.2s",
        position: "relative",
        opacity,
      }}
    >
      {isDual && dualNumbers ? (
        <>
          <span style={{ fontSize: "1.35rem", fontWeight: 700 }}>{dualNumbers.first}</span>
          <span style={{ fontSize: "0.675rem", opacity: 0.8 }}>Dual</span>
          <span style={{ fontSize: "1.35rem", fontWeight: 700 }}>{dualNumbers.second}</span>
        </>
      ) : (
        seat.number
      )}
      {isRecommended && !isSelected && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 24,
            height: 24,
            borderRadius: 12,
            background: COLORS.warning,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: COLORS.text }}>★</span>
        </div>
      )}
    </button>
  );
}

function PassView({
  completedGuestName,
  nextGuestNumber,
  totalGuests,
  dailyOrderNumber,
  paymentType,
  selectedPod,
  onPassDevice,
}: {
  completedGuestName: string;
  nextGuestNumber: number;
  totalGuests: number;
  dailyOrderNumber?: number;
  paymentType: "single" | "separate";
  selectedPod?: Seat;
  onPassDevice: () => void;
}) {
  const tKiosk = useTranslations("kiosk");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.surface,
        color: COLORS.text,
        padding: 48,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%",
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Brand Header */}
      <div style={{ position: "absolute", top: 24, left: 24, zIndex: 1 }}>
        <KioskBrand size="normal" />
      </div>

      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          background: COLORS.successLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          zIndex: 1,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
        {paymentType === "separate" ? tKiosk("orderFlow.paymentComplete") : tKiosk("orderFlow.orderAdded")}
      </h1>
      <p style={{ color: COLORS.textMuted, marginBottom: 8 }}>
        {tKiosk("orderFlow.orderSaved", { name: completedGuestName })}
      </p>
      {dailyOrderNumber && (
        <p style={{ color: COLORS.primary, fontWeight: 600, fontSize: "1.25rem" }}>
          {tKiosk("orderFlow.orderNumber", { number: dailyOrderNumber })}
        </p>
      )}
      {selectedPod && (
        <p style={{ color: COLORS.primary, fontWeight: 600 }}>{tKiosk("pod.podNumber", { number: selectedPod.number })}</p>
      )}

      <div
        style={{
          marginTop: 48,
          padding: 32,
          background: COLORS.primaryLight,
          borderRadius: 16,
          border: `2px solid ${COLORS.primary}`,
        }}
      >
        <div style={{ fontSize: "1.25rem", marginBottom: 8 }}>
          {tKiosk("orderFlow.passDevice", { number: nextGuestNumber })}
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: "0.9rem" }}>
          {totalGuests - nextGuestNumber + 1 > 1
            ? tKiosk("orderFlow.guestsRemaining", { count: totalGuests - nextGuestNumber + 1 })
            : tKiosk("orderFlow.guestRemaining", { count: totalGuests - nextGuestNumber + 1 })}
        </div>
      </div>

      <button
        onClick={onPassDevice}
        style={{
          marginTop: 48,
          padding: "20px 64px",
          background: COLORS.primary,
          border: "none",
          borderRadius: 16,
          color: COLORS.textOnPrimary,
          fontSize: "1.25rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {tKiosk("orderFlow.nextGuestReady")}
      </button>
    </main>
  );
}

function PaymentView({
  paymentType,
  guestOrders,
  currentGuestIndex,
  seats,
  taxRate,
  onPay,
  onBack,
  submitting,
}: {
  paymentType: "single" | "separate";
  guestOrders: GuestOrder[];
  currentGuestIndex: number;
  seats: Seat[];
  taxRate: number;
  onPay: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const tKiosk = useTranslations("kiosk");

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const currentGuest = guestOrders[currentGuestIndex];

  // Calculate totals with tax breakdown
  const subtotalCents =
    paymentType === "single"
      ? guestOrders.reduce((sum, g) => sum + (g.subtotalCents || 0), 0)
      : currentGuest.subtotalCents || 0;
  const taxCents =
    paymentType === "single"
      ? guestOrders.reduce((sum, g) => sum + (g.taxCents || 0), 0)
      : currentGuest.taxCents || 0;
  const totalCents = subtotalCents + taxCents;

  const selectedPods = guestOrders
    .filter((g) => g.selectedPodId)
    .map((g) => seats.find((s) => s.id === g.selectedPodId))
    .filter(Boolean) as Seat[];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.surface,
        color: COLORS.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%",
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Large Brand Header - top left (matching other views) */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Fixed Header with color */}
      <div style={{
        textAlign: "center",
        paddingTop: 32,
        paddingBottom: 20,
        background: COLORS.primaryLight,
        borderBottom: `1px solid ${COLORS.primaryBorder}`,
        zIndex: 1,
      }}>
        <h1 className="kiosk-title" style={{ fontSize: "3.5rem", fontWeight: 700, marginBottom: 8 }}>
          {tKiosk("orderFlow.payment")}
        </h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>
          {paymentType === "single"
            ? tKiosk("orderFlow.oneCheckForGuests", { count: guestOrders.length })
            : `${currentGuest.guestName}`}
        </p>
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          paddingBottom: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 500 }}>
          {paymentType === "single" ? (
            <div
              style={{
                background: COLORS.surfaceElevated,
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {guestOrders.map((g, i) => {
                const pod = seats.find((s) => s.id === g.selectedPodId);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: i < guestOrders.length - 1 ? `1px solid ${COLORS.border}` : "none",
                      fontSize: "1.1rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{g.guestName}</span>
                      {pod && (
                        <span style={{ color: COLORS.textMuted, marginLeft: 8, fontSize: "0.9rem" }}>
                          {tKiosk("pod.podNumber", { number: pod.number })}
                        </span>
                      )}
                    </div>
                    <span>${((g.totalCents || 0) / 100).toFixed(2)}</span>
                  </div>
                );
              })}
              {/* Subtotal */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 16,
                  marginTop: 12,
                  borderTop: `1px solid ${COLORS.border}`,
                  fontSize: "1.05rem",
                }}
              >
                <span style={{ color: COLORS.textMuted }}>{tKiosk("orderFlow.subtotal")}</span>
                <span>${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              {/* Tax */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 8,
                  fontSize: "1.05rem",
                }}
              >
                <span style={{ color: COLORS.textMuted }}>{tKiosk("orderFlow.tax")} ({(taxRate * 100).toFixed(2)}%)</span>
                <span>${(taxCents / 100).toFixed(2)}</span>
              </div>
              {/* Total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 16,
                  marginTop: 12,
                  borderTop: `2px solid ${COLORS.primary}`,
                  fontWeight: 700,
                  fontSize: "1.4rem",
                }}
              >
                <span>{tKiosk("orderFlow.total")}</span>
                <span style={{ color: COLORS.primary }}>${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <>
              {currentGuest.selectedPodId && (
                <div
                  style={{
                    background: COLORS.primaryLight,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 24,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 600, color: COLORS.primary, fontSize: "1.1rem" }}>
                    {tKiosk("pod.podNumber", { number: seats.find((s) => s.id === currentGuest.selectedPodId)?.number })}
                  </div>
                </div>
              )}
              {/* Price breakdown for separate payment */}
              <div
                style={{
                  background: COLORS.surfaceElevated,
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 24,
                  border: `1px solid ${COLORS.border}`,
                  textAlign: "center",
                }}
              >
                <div style={{ color: COLORS.textMuted, fontSize: "1.1rem", marginBottom: 8 }}>
                  {tKiosk("orderFlow.subtotal")}: ${(subtotalCents / 100).toFixed(2)}
                </div>
                <div style={{ color: COLORS.textMuted, fontSize: "1.1rem", marginBottom: 16 }}>
                  {tKiosk("orderFlow.tax")} ({(taxRate * 100).toFixed(2)}%): ${(taxCents / 100).toFixed(2)}
                </div>
                <div
                  style={{
                    fontSize: "3rem",
                    fontWeight: 700,
                    color: COLORS.primary,
                  }}
                >
                  ${(totalCents / 100).toFixed(2)}
                </div>
              </div>
            </>
          )}

          {/* Pod Summary - only show for single payment if multiple pods */}
          {paymentType === "single" && selectedPods.length > 0 && (
            <div
              style={{
                background: COLORS.primaryLight,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: "1.1rem" }}>{tKiosk("orderFlow.yourPods")}</div>
              <div style={{ color: COLORS.textMuted, fontSize: "1.05rem" }}>
                {selectedPods.map((p) => tKiosk("pod.podNumber", { number: p.number })).join(", ")}
              </div>
            </div>
          )}

          <div
            style={{
              padding: 16,
              background: COLORS.warningLight,
              border: `1px solid ${COLORS.warning}`,
              borderRadius: 12,
              color: "#92400e",
              fontSize: "1rem",
              textAlign: "center",
            }}
          >
            {tKiosk("orderFlow.demoModeTap")}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation with color */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          background: COLORS.primaryLight,
          borderTop: `1px solid ${COLORS.primaryBorder}`,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          disabled={submitting}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
            fontSize: "1.1rem",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {tKiosk("orderFlow.back")}
        </button>
        <button
          onClick={onPay}
          disabled={submitting}
          style={{
            padding: "16px 48px",
            background: submitting ? "#ccc" : COLORS.success,
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
            fontSize: "1.25rem",
            fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? tKiosk("orderFlow.submitting") : `${tKiosk("orderFlow.pay")} $${(totalCents / 100).toFixed(2)}`}
        </button>
      </div>
    </main>
  );
}

function CompleteView({
  guestOrders,
  seats,
  location,
  onNewOrder,
}: {
  guestOrders: GuestOrder[];
  seats: Seat[];
  location: Location;
  onNewOrder: () => void;
}) {
  const locale = useLocale();
  const tKiosk = useTranslations("kiosk");
  const [countdown, setCountdown] = useState(30);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Auto-reset countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShouldRedirect(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle redirect in a separate effect to avoid setState during render
  useEffect(() => {
    if (shouldRedirect) {
      onNewOrder();
    }
  }, [shouldRedirect, onNewOrder]);

  // Generate QR code value for an order - web URL for phone scanning
  const getQRValue = (guest: GuestOrder) => {
    const qrCode = guest.orderQrCode || guest.orderId;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/order/status?orderQrCode=${encodeURIComponent(qrCode || "")}`;
  };

  // Handle printing receipts
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      for (const guest of guestOrders) {
        const pod = seats.find((s) => s.id === guest.selectedPodId);
        const qrUrl = getQRValue(guest);
        const qrDataUrl = await generateQRDataUrl(qrUrl);

        const doc = (
          <PrintableReceipt
            guestName={guest.guestName}
            orderNumber={guest.orderNumber || ""}
            dailyOrderNumber={String(guest.dailyOrderNumber || "")}
            qrCodeUrl={qrUrl}
            qrDataUrl={qrDataUrl}
            podNumber={pod?.number}
            queuePosition={guest.queuePosition}
            estimatedWaitMinutes={guest.estimatedWaitMinutes}
            locationName={location.name}
            locale={locale}
          />
        );

        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);

        // Open PDF in new window for printing
        const printWindow = window.open(url, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    } catch (error) {
      console.error("Failed to print receipts:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.surface,
        color: COLORS.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark on right side - 30% cut off */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-15%",
          transform: "translateY(-50%)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt=""
          style={{
            height: "90vh",
            width: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Large Brand Header - top left (matching other views) */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Fixed Header with success color */}
      <div
        style={{
          textAlign: "center",
          paddingTop: 32,
          paddingBottom: 24,
          background: COLORS.successLight,
          borderBottom: `1px solid ${COLORS.success}`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="kiosk-title" style={{ fontSize: "3rem", fontWeight: 700, marginBottom: 8 }}>
          {tKiosk("orderFlow.allSet")}
        </h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>
          {tKiosk("orderFlow.scanQrAtPod")}
        </p>
      </div>

      {/* Scrollable Content - Order Cards */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 24px",
          paddingBottom: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            justifyContent: "center",
            maxWidth: 1200,
          }}
        >
          {guestOrders.map((g) => {
            const pod = seats.find((s) => s.id === g.selectedPodId);
            const isQueued = !pod && g.queuePosition;
            return (
              <div
                key={g.guestNumber}
                style={{
                  background: COLORS.surfaceElevated,
                  borderRadius: 24,
                  padding: 28,
                  border: `2px solid ${isQueued ? COLORS.warning : COLORS.primary}`,
                  minWidth: 280,
                  textAlign: "center",
                }}
              >
                {/* Guest name */}
                <div style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 4, color: COLORS.text }}>
                  {g.guestName}
                </div>

                {/* Order number */}
                <div style={{ fontSize: "2.5rem", fontWeight: 700, color: COLORS.primary, marginBottom: 16 }}>
                  #{g.dailyOrderNumber || "---"}
                </div>

                {/* QR Code */}
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: 12,
                    borderRadius: 12,
                    display: "inline-block",
                    marginBottom: 16,
                  }}
                >
                  <QRCodeSVG
                    value={getQRValue(g)}
                    size={140}
                    level="M"
                    includeMargin={false}
                    fgColor="#1a1a1a"
                    bgColor="#FFFFFF"
                  />
                </div>

                {/* Pod assignment or Queue position */}
                {pod ? (
                  <div
                    style={{
                      background: COLORS.primaryLight,
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: "1rem", color: COLORS.textMuted }}>{tKiosk("orderFlow.yourPod")}</div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: COLORS.primary }}>
                      {tKiosk("pod.podNumber", { number: pod.number })}
                    </div>
                  </div>
                ) : g.queuePosition ? (
                  <div
                    style={{
                      background: COLORS.warningLight,
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: "1rem", color: COLORS.warning }}>{tKiosk("orderFlow.queuePosition")}</div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: COLORS.warning }}>
                      #{g.queuePosition}
                    </div>
                    {g.estimatedWaitMinutes && (
                      <div style={{ fontSize: "0.9rem", color: COLORS.textMuted, marginTop: 4 }}>
                        {tKiosk("orderFlow.minWait", { minutes: g.estimatedWaitMinutes })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div style={{ marginTop: 32, textAlign: "center", maxWidth: 500 }}>
          <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, lineHeight: 1.6 }}>
            {tKiosk("orderFlow.scanQrPhone")}
          </p>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px 32px",
          background: COLORS.primaryLight,
          borderTop: `1px solid ${COLORS.primaryBorder}`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          zIndex: 10,
        }}
      >
        <div style={{ color: COLORS.textMuted, fontSize: "1rem" }}>
          {tKiosk("orderFlow.screenResetsIn", { seconds: countdown })}
        </div>
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          style={{
            padding: "14px 28px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
            fontSize: "1rem",
            cursor: isPrinting ? "wait" : "pointer",
            opacity: isPrinting ? 0.7 : 1,
          }}
        >
          {tKiosk("orderFlow.reprintReceipts")}
        </button>
        <button
          onClick={onNewOrder}
          style={{
            padding: "14px 40px",
            background: COLORS.primary,
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {tKiosk("orderFlow.startNewOrder")}
        </button>
      </div>
    </main>
  );
}
