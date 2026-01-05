// Pod selection color constants - matching kiosk design
export const POD_COLORS = {
  available: "#22c55e",      // green - single pod available
  dualPod: "#0891b2",        // cyan - dual pod available
  cleaning: "#f59e0b",       // amber - cleaning
  occupied: "#ef4444",       // red - occupied/unavailable
  selected: "#7C7A67",       // primary - user's selection
  unavailableDual: "#9ca3af", // gray - dual pod not selectable
  border: "#7C7A67",         // decorative border color
  borderLight: "rgba(124, 122, 103, 0.4)",
  background: "rgba(124, 122, 103, 0.08)",
  kitchenBg: "rgba(124, 122, 103, 0.2)",
};

// Location IDs for location-specific configurations
export const LOCATION_IDS = {
  UNIVERSITY_PLACE: "cmip6jbza00042nnnf4nc0dvh",
  CITY_CREEK: "cmip6jbz700022nnnxxpmm5hf",
};

// Responsive pod sizes
export const POD_SIZES = {
  mobile: 48,   // <640px
  tablet: 56,   // 640-1024px
  desktop: 64,  // >1024px
};
