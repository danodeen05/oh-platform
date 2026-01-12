"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  highlight?: boolean; // For special highlight like Analytics
};

const navItems: NavItem[] = [
  { href: "/kitchen", label: "Kitchen" },
  { href: "/cleaning", label: "Cleaning" },
  { href: "/cleaning/config", label: "Pod Config" },
  { href: "/kiosks", label: "Kiosks" },
  { href: "/analytics", label: "Analytics", highlight: true },
  { href: "/menu", label: "Menu" },
  { href: "/products", label: "Products" },
  { href: "/promos", label: "Promos", highlight: true },
  { href: "/gift-cards/config", label: "Gift Cards" },
  { href: "/locations", label: "Locations" },
];

export function AdminNav() {
  const pathname = usePathname();

  // Determine if a nav item is active
  const isActive = (href: string) => {
    // Exact match for specific routes
    if (href === "/cleaning/config") {
      return pathname === href;
    }
    // For other routes, check if pathname starts with href
    // but make sure /cleaning doesn't match /cleaning/config
    if (href === "/cleaning") {
      return pathname === "/cleaning" || (pathname?.startsWith("/cleaning/") && !pathname.startsWith("/cleaning/config"));
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {navItems.map((item) => {
        const active = isActive(item.href);

        // Default styles
        let bgColor = "transparent";
        let textColor = "#4b5563";
        let fontWeight = 500;

        if (active) {
          // Active state
          bgColor = "#5A5847";
          textColor = "#FFFFFF";
          fontWeight = 600;
        } else if (item.highlight) {
          // Special highlight for Analytics (when not active)
          bgColor = "#eff6ff";
          textColor = "#2563eb";
          fontWeight = 600;
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              textDecoration: "none",
              color: textColor,
              fontSize: "0.875rem",
              fontWeight: fontWeight,
              background: bgColor,
              transition: "all 0.15s ease",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
