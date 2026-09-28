/**
 * The Payment Element in the night palette (Stripe needs literal colors, not
 * CSS variables). Shared by the order pay step (Task D5) and the meal-gift
 * giving flow (Task D9).
 */
export const NIGHT_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#E07A5A",
    colorBackground: "#1C1B19",
    colorText: "#F2EDE4",
    colorTextSecondary: "#9A9188",
    colorTextPlaceholder: "#8A8178",
    colorDanger: "#E07A5A",
    borderRadius: "14px",
    fontFamily: "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #3A3632", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #F2EDE4", boxShadow: "none" },
    ".Tab": { border: "1px solid #3A3632", backgroundColor: "#2A2724" },
    ".Tab--selected": { borderColor: "#E07A5A", backgroundColor: "#3A3632" },
    ".Label": { color: "#F2EDE4", fontWeight: "600" },
  },
};

export const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&display=swap" }];
