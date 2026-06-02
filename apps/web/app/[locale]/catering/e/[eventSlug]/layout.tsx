import { ReactNode } from "react";
import { fetchCateringEvent } from "@/lib/catering/api";
import { buildTheme, themeToVars } from "@/lib/catering/theme";

interface EventLayoutProps {
  children: ReactNode;
  params: Promise<{ eventSlug: string; locale: string }>;
}

/**
 * Server component layout.
 * Fetches the event, builds a theme from brandColors, and injects CSS vars
 * on a wrapper div. All child components read var(--brand-primary) etc.
 *
 * Falls back to neutral default palette if the event has no brandColors.
 */
export default async function EventLayout({ children, params }: EventLayoutProps) {
  const { eventSlug } = await params;

  let brandColors: string[] = [];
  try {
    const event = await fetchCateringEvent(eventSlug);
    brandColors = event.brandColors || [];
  } catch {
    // Event not found — use defaults; the page itself will handle the error
  }

  const theme = buildTheme(brandColors);
  const cssVars = themeToVars(theme);

  return (
    <div
      style={{
        ...cssVars,
        minHeight: "100vh",
        background: "var(--brand-bg)",
        fontFamily: "'Raleway', sans-serif",
      }}
    >
      {children}
    </div>
  );
}
