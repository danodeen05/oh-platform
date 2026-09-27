import { canAccess, type AdminRole } from "./access";
import type { IconName } from "../components/ui/icons";

export type Report = { href: string; title: string; blurb: string; icon: IconName };

/** The 10 analytics report subpages, in the order they appear on the hub. */
export const REPORTS: Report[] = [
  { href: "/analytics/traffic", title: "Traffic", blurb: "GA4 page views, sources and devices.", icon: "chart" },
  { href: "/analytics/funnel", title: "Funnel", blurb: "Order funnel with drop-off and conversion.", icon: "filter" },
  { href: "/analytics/revenue", title: "Revenue", blurb: "Trends and location comparisons.", icon: "money" },
  { href: "/analytics/operations", title: "Operations", blurb: "Prep times, wait times and peak hours.", icon: "clock" },
  { href: "/analytics/customers", title: "Customers", blurb: "New vs returning and lifetime value.", icon: "users" },
  { href: "/analytics/menu", title: "Menu", blurb: "Top sellers and category performance.", icon: "bowl" },
  { href: "/analytics/upselling", title: "Upselling", blurb: "Add-on revenue and popularity.", icon: "tag" },
  { href: "/analytics/languages", title: "Languages", blurb: "Browser languages and localization gaps.", icon: "globe" },
  { href: "/analytics/challenges", title: "Challenges", blurb: "Engagement and completion rates.", icon: "trophy" },
  { href: "/analytics/badges", title: "Badges", blurb: "Distribution and recent awards.", icon: "badge" },
];

/** The reports a role can open, in the same order as REPORTS. */
export function reportsFor(role: AdminRole): Report[] {
  return REPORTS.filter((r) => canAccess(role, r.href));
}

export type Period = "today" | "yesterday" | "week" | "month" | "quarter" | "year";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "quarter", label: "90 days" },
  { value: "year", label: "Year" },
];
