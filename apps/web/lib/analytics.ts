// Google Analytics 4 integration and event tracking utilities

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Helper to safely send GA4 events via dataLayer (works even before gtag loads)
const sendEvent = (eventName: string, params: Record<string, unknown>) => {
  if (typeof window === "undefined") return;

  // Initialize dataLayer if needed
  window.dataLayer = window.dataLayer || [];

  // Push event to dataLayer - this works even if gtag hasn't loaded yet
  window.dataLayer.push({
    event: eventName,
    ...params,
  });

  // Also call gtag if available for immediate processing
  if (window.gtag) {
    window.gtag("event", eventName, params);
  }
};

// Initialize Google Analytics
export const pageview = (url: string) => {
  if (typeof window !== "undefined" && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Generic event tracking
export const event = ({
  action,
  category,
  label,
  value,
  ...params
}: {
  action: string;
  category: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
}) => {
  sendEvent(action, {
    event_category: category,
    event_label: label,
    value: value,
    ...params,
  });
};

// ==================
// E-COMMERCE EVENTS
// ==================

export const trackViewItem = (item: {
  id: string;
  name: string;
  category?: string;
  price: number;
}) => {
  sendEvent("view_item", {
    currency: "USD",
    value: item.price,
    items: [
      {
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
      },
    ],
  });
};

export const trackAddToCart = (item: {
  id: string;
  name: string;
  category?: string;
  price: number;
  quantity: number;
}) => {
  sendEvent("add_to_cart", {
    currency: "USD",
    value: item.price * item.quantity,
    items: [
      {
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: item.quantity,
      },
    ],
  });
};

export const trackRemoveFromCart = (item: {
  id: string;
  name: string;
  price: number;
  quantity: number;
}) => {
  sendEvent("remove_from_cart", {
    currency: "USD",
    value: item.price * item.quantity,
    items: [
      {
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      },
    ],
  });
};

export const trackBeginCheckout = (cart: {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}) => {
  sendEvent("begin_checkout", {
    currency: "USD",
    value: cart.total,
    items: cart.items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

export const trackPurchase = (order: {
  orderId: string;
  total: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}) => {
  sendEvent("purchase", {
    transaction_id: order.orderId,
    currency: "USD",
    value: order.total,
    items: order.items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

// ==================
// RESTAURANT-SPECIFIC EVENTS
// ==================

export const trackLocationSelected = (location: {
  id: string;
  name: string;
  city?: string;
}) => {
  sendEvent("location_selected", {
    location_id: location.id,
    location_name: location.name,
    location_city: location.city,
  });
};

export const trackPodSelected = (pod: {
  number: number;
  locationId: string;
}) => {
  sendEvent("pod_selected", {
    pod_number: pod.number,
    location_id: pod.locationId,
  });
};

export const trackCheckIn = (order: {
  orderId: string;
  locationId: string;
  arrivalDeviation?: number;
}) => {
  sendEvent("check_in", {
    order_id: order.orderId,
    location_id: order.locationId,
    arrival_deviation_minutes: order.arrivalDeviation,
  });
};

export const trackMenuCategoryViewed = (category: string) => {
  event({
    action: "view_menu_category",
    category: "engagement",
    label: category,
  });
};

export const trackLoyaltySignup = () => {
  event({
    action: "loyalty_signup",
    category: "engagement",
  });
};

export const trackReferralCodeUsed = (code: string) => {
  event({
    action: "referral_code_used",
    category: "engagement",
    label: code,
  });
};

export const trackFavoriteAdded = (item: { id: string; name: string }) => {
  event({
    action: "add_to_favorites",
    category: "engagement",
    label: item.name,
    item_id: item.id,
  });
};

export const trackReorder = (orderId: string) => {
  event({
    action: "reorder",
    category: "engagement",
    label: orderId,
  });
};

// ==================
// USER EVENTS
// ==================

export const trackSignUp = (method: string) => {
  sendEvent("sign_up", { method });
};

export const trackLogin = (method: string) => {
  sendEvent("login", { method });
};

// Set user properties for better segmentation
export const setUserProperties = (properties: {
  membershipTier?: string;
  lifetimeOrderCount?: number;
  lifetimeSpent?: number;
}) => {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "set_user_properties",
    user_properties: properties,
  });

  if (window.gtag) {
    window.gtag("set", "user_properties", properties);
  }
};
