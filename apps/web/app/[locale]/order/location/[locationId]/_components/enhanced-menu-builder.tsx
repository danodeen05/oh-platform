"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslations, useLocale } from "next-intl";
import { SliderControl, SliderLegend } from "./slider-control";
import { RadioGroup } from "./radio-group";
import { CheckboxGroup } from "./checkbox-group";
import { DietaryLegend } from "./dietary-legend";
import SeatingMap, { Seat } from "@/components/SeatingMap";
import { useGuest } from "@/contexts/guest-context";
import { useToast } from "@/components/ui/Toast";
import { MealGiftModal } from "@/components/MealGiftModal";
import { trackAddToCart, trackRemoveFromCart, trackLocationSelected, trackPodSelected, trackMenuCategoryViewed, event } from "@/lib/analytics";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Order Whisperer - Witty insights from order history
type OrderInsight = {
  type: string;
  trigger: string;
  oneLiner: string;
  item?: string;
  items?: string[];
  count?: number;
  tone: string;
};

type OrderPatterns = {
  hasPatterns: boolean;
  orderCount: number;
  insights: OrderInsight[];
};

type MenuItem = {
  id: string;
  name: string;
  nameEn?: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  category?: string;
  categoryType?: string;
  selectionMode?: string;
  description?: string;
  sliderConfig?: any;
  isAvailable: boolean;
  // Dietary information
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  spiceLevel?: number; // 0=none, 1=mild, 2=medium, 3=hot
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


type MealGift = {
  id: string;
  amountCents: number;
  messageFromGiver: string | null;
  payForwardCount: number;
  giver: {
    name: string;
  };
  location: {
    name: string;
    city: string;
  };
};
type EnhancedMenuBuilderProps = {
  location: any;
  reorderId?: string;
  groupCode?: string;
};

// Chef's Choice preset - the default quick order items
const CHEFS_CHOICE = {
  soupId: "cmip6jbza00062nnnskz6ntt8", // Classic Beef Noodle Soup
  noodleId: "cmip6jbzd000c2nnny2hrd859", // Wide Noodles
  waterId: "cmip6jc0i002f2nnnyv38o0iz", // Water (cold)
  dessertId: "cmip6jc0i002f2nnnav38o0ib", // Mandarin Orange Sherbet
};

export default function EnhancedMenuBuilder({
  location,
  reorderId,
  groupCode,
}: EnhancedMenuBuilderProps) {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { guest, isGuest } = useGuest();
  const t = useTranslations("order");
  const tMenu = useTranslations("menu");
  const locale = useLocale();
  const toast = useToast();

  // Dietary labels for menu item badges
  const dietaryLabels = {
    vegetarian: tMenu("dietary.vegetarian"),
    vegan: tMenu("dietary.vegan"),
    glutenFree: tMenu("dietary.glutenFree"),
    spiceMild: tMenu("dietary.spice.level1"),
    spiceMedium: tMenu("dietary.spice.level2"),
    spiceHot: tMenu("dietary.spice.level3"),
  };

  // Dietary legend labels (for the legend at bottom of each step)
  const dietaryLegendLabels = {
    vegetarian: tMenu("dietary.vegetarian"),
    vegan: tMenu("dietary.vegan"),
    glutenFree: tMenu("dietary.glutenFree"),
    spicy: t("builder.dietaryLegend.spicy"),
    moreInfo: t("builder.dietaryLegend.moreInfo"),
  };
  const [menuSteps, setMenuSteps] = useState<MenuStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Order Whisperer state
  const [orderPatterns, setOrderPatterns] = useState<OrderPatterns | null>(null);
  const [shownWhispers, setShownWhispers] = useState<Set<string>>(new Set());
  const [currentWhisper, setCurrentWhisper] = useState<string | null>(null);
  const [whisperVisible, setWhisperVisible] = useState(false);

  // Cart state: { menuItemId: quantity } for counters, or { menuItemId: sliderValue } for sliders
  const [cart, setCart] = useState<Record<string, number>>({});

  // Slider labels: { menuItemId: label } for displaying selected value (e.g., "Light", "Medium")
  const [sliderLabels, setSliderLabels] = useState<Record<string, string>>({});

  // Selections for single-choice sections (radio groups)
  const [selections, setSelections] = useState<Record<string, string>>({});

  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(reorderId || null);

  // Seat selection state
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [showSeatSelection, setShowSeatSelection] = useState(false);

  // Meal gift state
  const [pendingMealGift, setPendingMealGift] = useState<MealGift | null>(null);
  const [showMealGiftModal, setShowMealGiftModal] = useState(false);
  const [acceptedMealGiftId, setAcceptedMealGiftId] = useState<string | null>(null);

  // Operating hours availability
  const [availability, setAvailability] = useState<{
    canOrder: boolean;
    validArrivalTimes: string[];
    preOrderMessage: string | null;
    statusMessage: string | null;
    closesAt: string | null;
  } | null>(null);

  // Database user ID for group orders
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  // Group order info (for non-host members to skip arrival time)
  const [groupOrderInfo, setGroupOrderInfo] = useState<{
    isHost: boolean;
    estimatedArrival: string | null;
    hostUserId: string | null;
    hostGuestId: string | null;
  } | null>(null);

  // Fetch database user ID when Clerk user is available
  useEffect(() => {
    async function fetchDbUser() {
      if (!userLoaded) return;

      // If no Clerk user, clear dbUserId
      if (!user?.primaryEmailAddress?.emailAddress) {
        setDbUserId(null);
        return;
      }

      try {
        const res = await fetch(`${BASE}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": "oh",
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress.emailAddress,
            name: user.fullName || user.firstName || undefined,
          }),
        });

        if (res.ok) {
          const userData = await res.json();
          setDbUserId(userData.id);
          localStorage.setItem("userId", userData.id);
          localStorage.setItem("referralCode", userData.referralCode);
        }
      } catch (e) {
        console.error("Failed to fetch db user:", e);
      }
    }

    fetchDbUser();
  }, [userLoaded, user?.primaryEmailAddress?.emailAddress, user?.fullName, user?.firstName]);

  // Fetch group order info if joining a group (to check if host and get arrival time)
  useEffect(() => {
    if (!groupCode) return;

    async function fetchGroupOrder() {
      try {
        const res = await fetch(`${BASE}/group-orders/${groupCode}`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (res.ok) {
          const groupData = await res.json();
          // Check if current user is the host
          const isHost = (dbUserId && dbUserId === groupData.hostUserId) ||
                         (isGuest && guest?.id && guest.id === groupData.hostGuestId);
          setGroupOrderInfo({
            isHost: !!isHost,
            estimatedArrival: groupData.estimatedArrival,
            hostUserId: groupData.hostUserId,
            hostGuestId: groupData.hostGuestId,
          });
        }
      } catch (e) {
        console.error("Failed to fetch group order:", e);
      }
    }

    fetchGroupOrder();
  }, [groupCode, dbUserId, isGuest, guest?.id]);

  // Fetch location availability for operating hours
  useEffect(() => {
    async function fetchAvailability() {
      try {
        const response = await fetch(`${BASE}/locations/${location.id}/availability`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (response.ok) {
          const data = await response.json();
          setAvailability({
            canOrder: data.canOrder,
            validArrivalTimes: data.validArrivalTimes || [],
            preOrderMessage: data.preOrderMessage,
            statusMessage: data.statusMessage,
            closesAt: data.closesAt,
          });
        }
      } catch (e) {
        console.error("Failed to fetch availability:", e);
      }
    }

    fetchAvailability();

    // Refresh availability every 60 seconds
    const interval = setInterval(fetchAvailability, 60000);
    return () => clearInterval(interval);
  }, [location.id]);

  // Load menu structure
  useEffect(() => {
    async function loadMenu() {
      try {
        const response = await fetch(`${BASE}/menu/steps?locale=${locale}`, {
          headers: { "x-tenant-slug": "oh" },
        });
        const data = await response.json();
        setMenuSteps(data.steps);

        // Initialize cart with slider default values and labels
        const initialCart: Record<string, number> = {};
        const initialLabels: Record<string, string> = {};
        data.steps.forEach((step: MenuStep) => {
          step.sections.forEach((section: MenuSection) => {
            if (section.selectionMode === 'SLIDER' && section.item && section.sliderConfig) {
              const defaultValue = section.sliderConfig.default ?? 0;
              initialCart[section.item.id] = defaultValue;
              // Get the label for the default value
              const labels = section.sliderConfig.labels || [];
              initialLabels[section.item.id] = labels[defaultValue] || String(defaultValue);
            }
          });
        });
        setCart(initialCart);
        setSliderLabels(initialLabels);

        // Track initial menu step view
        if (data.steps.length > 0) {
          trackMenuCategoryViewed(data.steps[0].name);
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to load menu:", error);
        toast.error(t("errors.loadMenu"));
      }
    }

    loadMenu();
  }, [locale]);

  // If reorderId is provided, load the order
  useEffect(() => {
    if (!reorderId) return;

    async function loadReorder() {
      try {
        const response = await fetch(`${BASE}/orders/${reorderId}`);
        if (!response.ok) throw new Error("Failed to load order");

        const order = await response.json();

        // Populate cart and sliderLabels from order items
        const cartData: Record<string, number> = {};
        const labelData: Record<string, string> = {};
        order.items.forEach((item: any) => {
          cartData[item.menuItem.id] = item.quantity;
          // Populate sliderLabels from the order's selectedValue
          if (item.selectedValue) {
            labelData[item.menuItem.id] = item.selectedValue;
          }
        });

        setCart(cartData);
        setSliderLabels(labelData);
        // Skip to time selection
        setCurrentStepIndex(menuSteps.length);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load reorder:", error);
        toast.error(t("errors.loadPreviousOrder"));
        router.push("/member/orders");
      }
    }

    loadReorder();
  }, [reorderId, menuSteps.length]);

  // Load order patterns for returning customers (Order Whisperer)
  useEffect(() => {
    if (!userLoaded || !user?.primaryEmailAddress?.emailAddress) return;

    async function loadOrderPatterns() {
      try {
        const email = user?.primaryEmailAddress?.emailAddress;
        const firstName = user?.firstName || "";
        const url = new URL(`${BASE}/users/by-email/${encodeURIComponent(email!)}/order-patterns`);
        if (firstName) {
          url.searchParams.set("firstName", firstName);
        }
        const response = await fetch(url.toString(), {
          headers: { "x-tenant-slug": "oh" },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.hasPatterns) {
            setOrderPatterns(data);
          }
        }
      } catch (error) {
        console.error("Failed to load order patterns:", error);
      }
    }

    loadOrderPatterns();
  }, [userLoaded, user?.primaryEmailAddress?.emailAddress, user?.firstName]);


  // Fetch pending meal gift for this location
  useEffect(() => {
    async function fetchPendingMealGift() {
      try {
        const response = await fetch(`${BASE}/meal-gifts/next/${location.id}`, {
          headers: { "x-tenant-slug": "oh" },
        });
        
        if (response.ok) {
          const gift = await response.json();
          setPendingMealGift(gift);
          setShowMealGiftModal(true);
        }
      } catch (error) {
        console.error("Failed to fetch pending meal gift:", error);
      }
    }

    fetchPendingMealGift();
  }, [location.id]);
  // Map step index to trigger type for Order Whisperer
  const getStepTrigger = useCallback((stepIndex: number): string | null => {
    // Based on actual menu step structure:
    // Step 0: Bowl (soup + noodles) -> "bowl_step" (also handles "noodle_step" insights)
    // Step 1: Customize (sliders) -> "customize_step"
    // Step 2: Extras/Add-ons/Sides -> "extras_step"
    // Step 3: Drinks/Desserts -> "drinks_step"
    const stepTriggers: Record<number, string> = {
      0: "bowl_step",       // Soup & noodle selection
      1: "customize_step",  // Sliders for texture, richness, spice, toppings
      2: "extras_step",     // Add-ons and sides
      3: "drinks_step",     // Drinks and desserts
    };
    return stepTriggers[stepIndex] || null;
  }, []);

  // Show whisper for current step if available and not already shown
  useEffect(() => {
    if (!orderPatterns?.hasPatterns) return;

    const trigger = getStepTrigger(currentStepIndex);
    if (!trigger) return;

    // Find an insight that matches this trigger and hasn't been shown
    const matchingInsight = orderPatterns.insights.find(
      (insight) => insight.trigger === trigger && !shownWhispers.has(insight.type)
    );

    if (matchingInsight && matchingInsight.oneLiner) {
      // Mark as shown
      setShownWhispers((prev) => new Set([...prev, matchingInsight.type]));

      // Show the whisper with animation
      setCurrentWhisper(matchingInsight.oneLiner);
      setWhisperVisible(true);

      // Auto-hide after 6 seconds
      const timer = setTimeout(() => {
        setWhisperVisible(false);
        setTimeout(() => setCurrentWhisper(null), 300); // Wait for fade out
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, orderPatterns, shownWhispers, getStepTrigger]);

  // Load seats when ASAP is selected
  useEffect(() => {
    if (arrivalTime !== "asap") {
      setShowSeatSelection(false);
      setSelectedSeatId(null);
      return;
    }

    async function loadSeats() {
      setLoadingSeats(true);
      try {
        const response = await fetch(`${BASE}/locations/${location.id}/seats`, {
          headers: { "x-tenant-slug": "oh" },
        });
        if (!response.ok) throw new Error("Failed to load seats");

        const seatsData = await response.json();
        // Map API response to Seat type (including dual pod info)
        const mappedSeats: Seat[] = seatsData.map((s: any) => ({
          id: s.id,
          number: s.number,
          status: s.status,
          side: s.side || "left",
          row: s.row || 0,
          col: s.col || 0,
          podType: s.podType || "SINGLE",
          dualPartnerId: s.dualPartnerId || null,
        }));

        setSeats(mappedSeats);

        // Show seat selection if there are available seats
        const hasAvailable = mappedSeats.some(s => s.status === "AVAILABLE");
        setShowSeatSelection(hasAvailable);
      } catch (error) {
        console.error("Failed to load seats:", error);
        setShowSeatSelection(false);
      } finally {
        setLoadingSeats(false);
      }
    }

    loadSeats();
  }, [arrivalTime, location.id]);

  // Calculate price for an item
  function getItemPrice(item: MenuItem, quantity: number): number {
    if (quantity === 0) return 0;

    // If additionalPriceCents is 0, use basePriceCents for each item
    const effectiveAdditionalPrice = item.additionalPriceCents || item.basePriceCents;

    // For sliders, quantity represents the slider value
    if (item.selectionMode === 'SLIDER') {
      // Check if this is a premium ingredient with additional pricing
      if (quantity <= item.includedQuantity) {
        return 0;
      }
      const extraQuantity = quantity - item.includedQuantity;
      return effectiveAdditionalPrice * extraQuantity;
    }

    // Standard quantity-based pricing
    if (quantity <= item.includedQuantity) {
      return 0;
    }

    if (item.includedQuantity > 0) {
      const extraQuantity = quantity - item.includedQuantity;
      return item.basePriceCents + effectiveAdditionalPrice * (extraQuantity - 1);
    }

    return item.basePriceCents + effectiveAdditionalPrice * (quantity - 1);
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

  // Calculate total - using useMemo to ensure Safari properly detects state changes
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

      // Track add to cart when quantity increases
      if (delta > 0 && newQty > current) {
        const allItems = getAllMenuItems();
        const item = allItems.find(i => i.id === itemId);
        if (item) {
          trackAddToCart({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.basePriceCents / 100,
            quantity: delta,
          });
        }
      }

      // Track remove from cart when quantity decreases
      if (delta < 0 && current > 0) {
        const allItems = getAllMenuItems();
        const item = allItems.find(i => i.id === itemId);
        if (item) {
          trackRemoveFromCart({
            id: item.id,
            name: item.name,
            price: item.basePriceCents / 100,
            quantity: Math.abs(delta),
          });
        }
      }

      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
  }

  // Handle slider change - always store the value (don't remove on 0 like checkboxes)
  function handleSliderChange(itemId: string, value: number, label: string) {
    setCart(prev => ({ ...prev, [itemId]: value }));
    setSliderLabels(prev => ({ ...prev, [itemId]: label }));
  }

  // Meal gift handlers
  function handleMealGiftAccept(giftId: string, message?: string) {
    setAcceptedMealGiftId(giftId);
    // Store message in localStorage to be passed at checkout
    if (message) {
      localStorage.setItem("mealGiftMessage", message);
    } else {
      localStorage.removeItem("mealGiftMessage");
    }
    setShowMealGiftModal(false);
    toast.success("Meal gift reserved! It will be applied at checkout.");
  }

  async function handleMealGiftPayForward(giftId: string) {
    const userId = dbUserId || localStorage.getItem("userId");
    if (!userId) {
      toast.error("Please sign in to pay forward a meal gift");
      return;
    }

    try {
      const response = await fetch(`${BASE}/meal-gifts/${giftId}/pay-forward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          recipientId: userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to pay forward meal gift");
      }

      toast.success("You paid it forward! The next person will receive this gift.");
      setShowMealGiftModal(false);
      setPendingMealGift(null);
    } catch (error) {
      console.error("Failed to pay forward:", error);
      toast.error("Failed to pay forward. Please try again.");
    }
  }

  function handleMealGiftClose() {
    setShowMealGiftModal(false);
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
        toast.warning(t("errors.completeRequired", { sections: requiredSections.join(", ") }));
        return;
      }
    }

    if (currentStepIndex < menuSteps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      // Track menu category navigation in GA4
      trackMenuCategoryViewed(menuSteps[nextIndex].name);
    } else {
      // Last menu step, move to time selection
      setCurrentStepIndex(menuSteps.length);
      // Track arrival time step
      trackMenuCategoryViewed("Arrival Time");
    }

    // Scroll to top when advancing to next step (setTimeout for Safari compatibility)
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
  }

  function previousStep() {
    const prevIndex = Math.max(0, currentStepIndex - 1);
    setCurrentStepIndex(prevIndex);
    // Track menu category navigation in GA4
    if (prevIndex < menuSteps.length) {
      trackMenuCategoryViewed(menuSteps[prevIndex].name);
    }
    // Scroll to top when going back (setTimeout for Safari compatibility)
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
  }

  async function proceedToPayment() {
    // Skip arrival time check for non-host group members
    const isNonHostMember = groupCode && groupOrderInfo && !groupOrderInfo.isHost;

    if (!isNonHostMember && !arrivalTime) {
      toast.warning(t("errors.selectArrivalTime"));
      return;
    }

    setSubmitting(true);

    // Calculate estimated arrival (not needed for non-host group members)
    let estimatedArrival = new Date();
    if (arrivalTime && arrivalTime !== "asap") {
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
        toast.error(t("errors.updateOrder"));
        setSubmitting(false);
        return;
      }

      order = await response.json();
    } else {
      // Build items array from selections and cart
      const items: Array<{ menuItemId: string; quantity: number; selectedValue?: string }> = [];

      // Add radio selections
      Object.values(selections).forEach(itemId => {
        items.push({ menuItemId: itemId, quantity: 1 });
      });

      // Add cart items (with selectedValue for sliders)
      Object.entries(cart).forEach(([itemId, qty]) => {
        const isSliderItem = itemId in sliderLabels;
        // For slider items: always include (even when qty/value is 0, e.g., "Light", "None")
        // For non-slider items (checkboxes): only include if qty > 0
        if (isSliderItem || qty > 0) {
          const selectedValue = sliderLabels[itemId]; // Will be undefined for non-slider items
          items.push({ menuItemId: itemId, quantity: qty, selectedValue });
        }
      });

      // For group orders, use the group order endpoint directly
      if (groupCode) {
        try {
          // Use guest ID if in guest mode
          const guestId = isGuest && guest?.id ? guest.id : null;

          // Ensure we have either a user ID or guest ID (dbUserId is from component state)
          if (!dbUserId && !guestId) {
            toast.error(t("errors.signInRequired"));
            setSubmitting(false);
            return;
          }

          const groupResponse = await fetch(`${BASE}/group-orders/${groupCode}/orders`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-slug": "oh",
            },
            body: JSON.stringify({
              items,
              userId: dbUserId || null,
              guestId: guestId,
            }),
          });

          if (!groupResponse.ok) {
            const errorData = await groupResponse.json().catch(() => ({}));
            console.error("Failed to add order to group:", errorData);
            toast.error(errorData.error || t("errors.addToGroup"));
            setSubmitting(false);
            return;
          }

          setSubmitting(false);
          router.push(`/group/${groupCode}`);
          return;
        } catch (e) {
          console.error("Error adding order to group:", e);
          toast.error(t("errors.addToGroup"));
          setSubmitting(false);
          return;
        }
      }

      // Build order payload for non-group orders - include seatId if customer selected one
      const guestId = isGuest && guest?.id ? guest.id : null;
      const orderPayload: any = {
        locationId: location.id,
        tenantId: location.tenantId,
        items,
        estimatedArrival: estimatedArrival.toISOString(),
        fulfillmentType: "PRE_ORDER",
        userId: dbUserId || null,
        guestId: guestId,
      };

      // If customer selected a seat (ASAP arrival with seat selection)
      if (selectedSeatId && arrivalTime === "asap") {
        const selectedSeat = seats.find(s => s.id === selectedSeatId);
        orderPayload.seatId = selectedSeatId;
        orderPayload.podSelectionMethod = "CUSTOMER_SELECTED";

        // If this is a dual pod, include the partner seat ID too
        if (selectedSeat?.podType === "DUAL" && selectedSeat.dualPartnerId) {
          orderPayload.dualPartnerSeatId = selectedSeat.dualPartnerId;
          orderPayload.isDualPod = true;
        }
      }

      const response = await fetch(`${BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Order creation failed:", response.status, errorData);
        toast.error(t("errors.createOrder"));
        setSubmitting(false);
        return;
      }

      order = await response.json();
    }

    if (!order || !order.id || !order.orderNumber) {
      console.error("Invalid order response:", order);
      toast.error(t("errors.createOrder"));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    router.push(
      `/order/payment?orderId=${order.id}&orderNumber=${order.orderNumber}&total=${order.totalCents}${acceptedMealGiftId ? `&mealGiftId=${acceptedMealGiftId}` : ""}`
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🍜</div>
          <div>{t("builder.loadingMenu")}</div>
        </div>
      </div>
    );
  }

  // For non-host group members, skip time selection and submit directly
  const isNonHostGroupMember = groupCode && groupOrderInfo && !groupOrderInfo.isHost;

  // Time selection view
  if (currentStepIndex >= menuSteps.length) {
    // For non-host group members, show a simplified view
    if (isNonHostGroupMember) {
      return (
        <div>
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

          <div
            style={{
              marginBottom: 24,
              padding: 20,
              background: "#f0fdf4",
              borderRadius: 12,
              border: "1px solid #86efac",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.5rem" }}>👥</span>
              <div>
                <div style={{ fontWeight: 600, color: "#166534" }}>Group Order: {groupCode}</div>
                <div style={{ fontSize: "0.85rem", color: "#15803d" }}>
                  Your order will be added to the group. The host will select the arrival time for everyone.
                </div>
              </div>
            </div>
          </div>

          <h2 style={{ marginBottom: 16 }}>Review Your Order</h2>
          <p style={{ color: "#666", marginBottom: 24 }}>
            The group host will decide when everyone arrives and select pods. You can view pod availability on the group lobby page after adding your order.
          </p>

          <div
            style={{
              padding: 20,
              background: "#f9fafb",
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Your Total</span>
              <span
                key={totalCents}
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#7C7A67",
                  transform: "translateZ(0)",
                  WebkitFontSmoothing: "antialiased",
                }}
              >
                ${(totalCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={proceedToPayment}
            disabled={submitting}
            style={{
              width: "100%",
              padding: 16,
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Adding to Group..." : "Add to Group Order"}
          </button>
        </div>
      );
    }

    // Standard time selection view for hosts and non-group orders
    const allTimeOptions = [
      { value: "asap", labelKey: "timeOptions.asap", minutes: 0 },
      { value: "15", labelKey: "timeOptions.15min", minutes: 15 },
      { value: "30", labelKey: "timeOptions.30min", minutes: 30 },
      { value: "45", labelKey: "timeOptions.45min", minutes: 45 },
      { value: "60", labelKey: "timeOptions.1hour", minutes: 60 },
      { value: "90", labelKey: "timeOptions.90min", minutes: 90 },
    ];

    // Filter time options based on availability
    const timeOptions = availability?.validArrivalTimes?.length
      ? allTimeOptions.filter((opt) => availability.validArrivalTimes.includes(opt.value))
      : allTimeOptions;

    // If ordering is closed, show message instead of time options
    if (availability && !availability.canOrder) {
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
              ← {t("builder.backToMenu")}
            </button>
          )}

          <div
            style={{
              padding: 32,
              background: "#fef2f2",
              borderRadius: 16,
              border: "1px solid #fca5a5",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>🕐</div>
            <h2 style={{ color: "#dc2626", marginBottom: 12 }}>
              {t("builder.orderingClosed")}
            </h2>
            <p style={{ color: "#7f1d1d", marginBottom: 24 }}>
              {availability.statusMessage || t("builder.orderingClosedMessage")}
            </p>
            <button
              onClick={() => window.location.href = `/${locale}/menu`}
              style={{
                padding: "12px 24px",
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {t("builder.viewMenu")}
            </button>
          </div>
        </div>
      );
    }

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
            ← {t("builder.backToMenu")}
          </button>
        )}

        {/* Pre-order message (when ordering before restaurant opens) */}
        {availability?.preOrderMessage && (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: "#fef3e2",
              borderRadius: 12,
              border: "1px solid #f9a825",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>☀️</span>
            <div style={{ color: "#92400e" }}>{availability.preOrderMessage}</div>
          </div>
        )}

        {groupCode && (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: "#fef3e2",
              borderRadius: 12,
              border: "1px solid #f9a825",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>👥</span>
            <div>
              <div style={{ fontWeight: 600, color: "#92400e" }}>Group Order: {groupCode}</div>
              <div style={{ fontSize: "0.85rem", color: "#b45309" }}>
                {groupOrderInfo?.isHost
                  ? "As the host, your arrival time will be used for the group"
                  : "Your order will be added to the group"}
              </div>
            </div>
          </div>
        )}

        <h2 style={{ marginBottom: 24 }}>{t("builder.whenWillYouArrive")}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 32 }}>
          {timeOptions.map((option) => {
            const isSelected = arrivalTime === option.value;
            const estimatedReadyTime = new Date(Date.now() + option.minutes * 60 * 1000);
            const timeStr = estimatedReadyTime.toLocaleTimeString(locale, {
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <button
                key={option.value}
                onClick={() => setArrivalTime(option.value)}
                style={{
                  border: `2px solid ${isSelected ? "#7C7A67" : "#e5e7eb"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: isSelected ? "#f0f4ff" : "white",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "0.95rem", marginBottom: 2 }}>
                      {t(`builder.${option.labelKey}`)}
                    </div>
                    <div style={{ color: "#666", fontSize: "0.8rem" }}>
                      {t("builder.readyBy", { time: timeStr })}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#7C7A67",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        flexShrink: 0,
                        marginLeft: 8,
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

        {/* Seat Selection - shown when ASAP is selected and seats available (NOT for group orders - host selects pods on lobby) */}
        {arrivalTime === "asap" && showSeatSelection && !groupCode && (
          <div
            style={{
              marginBottom: 32,
              padding: 24,
              background: "#f9fafb",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ marginBottom: 8, fontSize: "1.1rem" }}>
              {t("builder.choosePod")}
            </h3>
            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 16 }}>
              {t("builder.choosePodDescription")}
            </p>

            {loadingSeats ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                {t("builder.loadingSeats")}
              </div>
            ) : (
              <SeatingMap
                seats={seats}
                selectedSeatId={selectedSeatId}
                onSelectSeat={(seat) => {
                  setSelectedSeatId(seat.id);
                  trackPodSelected({
                    number: seat.number,
                    locationId: location.id,
                  });
                }}
                labels={{
                  available: t("builder.podLegend.available"),
                  selected: t("builder.podLegend.selected"),
                  reserved: t("builder.podLegend.reserved"),
                  occupied: t("builder.podLegend.occupied"),
                  dualPod: t("builder.podLegend.dualPod"),
                  entrance: t("builder.podMap.entrance"),
                  kitchen: t("builder.podMap.kitchen"),
                  exit: t("builder.podMap.exit"),
                  dual: t("builder.podMap.dual"),
                  selectedPrefix: t("builder.podSelection.selectedPrefix"),
                  pod: t("builder.podSelection.pod"),
                }}
              />
            )}

            {selectedSeatId && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  onClick={() => setSelectedSeatId(null)}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("builder.clearSelection")}
                </button>
              </div>
            )}
          </div>
        )}

        {arrivalTime === "asap" && loadingSeats && !groupCode && (
          <div
            style={{
              marginBottom: 32,
              padding: 24,
              background: "#f9fafb",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <div style={{ color: "#666" }}>{t("builder.checkingSeatAvailability")}</div>
          </div>
        )}

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
          {submitting
            ? t("builder.processing")
            : groupCode
              ? t("builder.addToGroupOrder")
              : t("builder.reviewOrderPayment")}
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
          <span>{t("builder.stepOf", { current: currentStepIndex + 1, total: menuSteps.length })}</span>
          <span>{currentStep.title}</span>
        </div>
      </div>

      {/* Quick Order - Chef's Choice (only show on first step and not in group mode) */}
      {currentStepIndex === 0 && !groupCode && (
        <div
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
            borderRadius: 10,
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
              <line x1="6" y1="17" x2="18" y2="17" />
            </svg>
            <span style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
              {t("quickOrder.title")}
            </span>
            <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.9)", fontSize: "0.8rem" }}>
              {t("quickOrder.description")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              {t("quickOrder.item1")} • {t("quickOrder.item2")} • {t("quickOrder.item3")} • {t("quickOrder.item4")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{t("quickOrder.price")}</span>
              <button
                onClick={() => {
                  // Pre-populate cart with Chef's Choice and skip to time selection
                  const initialSelections: Record<string, string> = {};
                  menuSteps.forEach((step: MenuStep) => {
                    step.sections.forEach((section: MenuSection) => {
                      if (section.selectionMode === 'SINGLE' && section.items) {
                        const hasSoup = section.items.find(item => item.id === CHEFS_CHOICE.soupId);
                        const hasNoodle = section.items.find(item => item.id === CHEFS_CHOICE.noodleId);
                        if (hasSoup) initialSelections[section.id] = CHEFS_CHOICE.soupId;
                        if (hasNoodle) initialSelections[section.id] = CHEFS_CHOICE.noodleId;
                      }
                    });
                  });
                  setSelections(initialSelections);
                  setCart(prev => ({
                    ...prev,
                    [CHEFS_CHOICE.waterId]: 1,
                    [CHEFS_CHOICE.dessertId]: 1,
                  }));
                  setCurrentStepIndex(menuSteps.length);
                }}
                style={{
                  padding: "8px 16px",
                  background: "white",
                  color: "#7C7A67",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {t("quickOrder.selectButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: currentWhisper ? 12 : 24 }}>{currentStep.title}</h2>

      {/* Order Whisperer - Witty one-liner based on order history */}
      {currentWhisper && (
        <div
          style={{
            marginBottom: 24,
            padding: "12px 16px",
            background: "linear-gradient(135deg, #f5f3ef 0%, #ebe8e2 100%)",
            borderRadius: 8,
            borderLeft: "3px solid #C7A878",
            opacity: whisperVisible ? 1 : 0,
            transform: whisperVisible ? "translateY(0)" : "translateY(-8px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "#7C7A67", fontStyle: "italic" }}>
              {currentWhisper}
            </span>
            <button
              onClick={() => {
                setWhisperVisible(false);
                setTimeout(() => setCurrentWhisper(null), 300);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "#999",
                fontSize: "0.8rem",
                marginLeft: "auto",
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Show slider legend if current step has sliders */}
      {currentStep.sections.some(s => s.selectionMode === 'SLIDER') && (
        <SliderLegend recommendationLabel={t("builder.ohRecommendation")} />
      )}

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
              required={section.required}
              requiredLabel={t("builder.required")}
              dietaryLabels={dietaryLabels}
            />
          );
        }

        if (section.selectionMode === 'SLIDER' && section.item && section.sliderConfig) {
          const value = cart[section.item.id] ?? section.sliderConfig.default ?? 0;
          const labels = section.sliderConfig.labels || [];
          // Build slider label translations object
          const sliderLabelTranslations: Record<string, string> = {};
          labels.forEach((label: string) => {
            sliderLabelTranslations[label] = t(`builder.sliderLabels.${label}`) || label;
          });
          return (
            <div key={section.id} style={{ marginBottom: 10 }}>
              <SliderControl
                name={section.name}
                nameEn={section.item.nameEn}
                description={section.description}
                value={value}
                onChange={(val) => {
                  const label = labels[val] || String(val);
                  handleSliderChange(section.item!.id, val, label);
                }}
                config={section.sliderConfig}
                pricingInfo={{
                  basePriceCents: section.item.basePriceCents,
                  additionalPriceCents: section.item.additionalPriceCents,
                  includedQuantity: section.item.includedQuantity,
                }}
                labelTranslations={sliderLabelTranslations}
                includedUpToLabel={t("builder.includedUpTo", { count: section.item.includedQuantity })}
                isVegetarian={section.item.isVegetarian}
                isVegan={section.item.isVegan}
                isGlutenFree={section.item.isGlutenFree}
                spiceLevel={section.item.spiceLevel}
                dietaryLabels={dietaryLabels}
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
              maxQuantity={section.maxQuantity}
              labels={{
                included: t("builder.included"),
                each: t("builder.each"),
                eachExtra: t("builder.eachExtra"),
                subtotal: t("builder.subtotalLabel"),
              }}
              dietaryLabels={dietaryLabels}
            />
          );
        }

        return null;
      })}

      {/* Dietary Legend */}
      <DietaryLegend labels={dietaryLegendLabels} />

      {/* Navigation */}
      <div style={{ position: "sticky", bottom: 0, background: "white", border: "1px solid rgba(124, 122, 103, 0.2)", borderRadius: "16px", padding: "24px 32px", marginTop: 32, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <strong style={{ fontSize: "1.1rem", color: "#222222" }}>{t("builder.total")}</strong>
          <strong
            key={totalCents}
            style={{
              fontSize: "1.8rem",
              color: "#7C7A67",
              paddingRight: "8px",
              transform: "translateZ(0)",
              WebkitFontSmoothing: "antialiased",
            }}
          >
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
              ← {t("builder.back")}
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
            {t("builder.continue")} →
          </button>
        </div>
      </div>

      {/* Meal Gift Modal */}
      {showMealGiftModal && pendingMealGift && (
        <MealGiftModal
          mealGift={pendingMealGift}
          userId={dbUserId || localStorage.getItem("userId") || ""}
          onAccept={handleMealGiftAccept}
          onPayForward={handleMealGiftPayForward}
          onClose={handleMealGiftClose}
        />
      )}
    </div>
  );
}
