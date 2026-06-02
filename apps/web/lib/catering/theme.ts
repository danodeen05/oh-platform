/**
 * Per-client CSS-variable theming for catering surfaces.
 *
 * The layout.tsx for each event sets these CSS custom properties on a wrapper
 * div. Every catering component reads var(--brand-primary) etc. — never
 * hardcodes CNY gold/red.
 *
 * Default palette: neutral/premium warm tones that look great without any
 * client branding.
 */

export interface CateringTheme {
  /** Main accent color — buttons, headings, highlights */
  primary: string;
  /** Complementary accent — secondary elements */
  secondary: string;
  /** Page background tint */
  bg: string;
  /** Text/icon color on primary-colored surfaces */
  onPrimary: string;
  /** Subtle surface color for cards / panels */
  surface: string;
  /** Border / divider color */
  border: string;
}

/** Premium neutral default — works for any client before enrichment */
export const DEFAULT_THEME: CateringTheme = {
  primary: "#C7A878",      // warm gold/tan
  secondary: "#8A7055",    // muted brown
  bg: "#0D0D0B",           // near-black warm
  onPrimary: "#1A1612",    // dark text on gold
  surface: "rgba(199,168,120,0.08)",
  border: "rgba(199,168,120,0.2)",
};

/**
 * Map an array of hex brand colors from the API into a CateringTheme.
 * Falls back to DEFAULT_THEME for any missing value.
 *
 * Leland example: ["#2563EB","#1E40AF","#EFF6FF"]  →  blue primary, dark secondary, light bg
 */
export function buildTheme(brandColors: string[] | undefined | null): CateringTheme {
  if (!brandColors || brandColors.length === 0) return DEFAULT_THEME;

  const [c0, c1, c2] = brandColors;

  return {
    primary: c0 ?? DEFAULT_THEME.primary,
    secondary: c1 ?? DEFAULT_THEME.secondary,
    bg: c2 ? adjustAlpha(c2, "0D") : DEFAULT_THEME.bg,
    onPrimary: getContrastColor(c0 ?? DEFAULT_THEME.primary),
    surface: c0 ? `${c0}14` : DEFAULT_THEME.surface,   // 8% opacity
    border: c0 ? `${c0}33` : DEFAULT_THEME.border,      // 20% opacity
  };
}

/**
 * Convert a CateringTheme into an inline style object that sets CSS variables.
 * Apply to the outermost div of e/[eventSlug]/layout.tsx.
 */
export function themeToVars(theme: CateringTheme): React.CSSProperties {
  return {
    "--brand-primary": theme.primary,
    "--brand-secondary": theme.secondary,
    "--brand-bg": theme.bg,
    "--brand-on-primary": theme.onPrimary,
    "--brand-surface": theme.surface,
    "--brand-border": theme.border,
  } as React.CSSProperties;
}

// ---- helpers ----------------------------------------------------------------

/** Append a two-char hex alpha byte to a 6-char hex color */
function adjustAlpha(hex: string, alpha: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  return `#${clean}${alpha}`;
}

/** Very simple perceived-brightness contrast: returns dark or white text */
function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // WCAG relative luminance approximation
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1A1612" : "#FFFFFF";
}
