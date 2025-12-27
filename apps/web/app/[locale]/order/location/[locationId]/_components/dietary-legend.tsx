"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";

type DietaryLegendProps = {
  labels?: {
    vegetarian?: string;
    vegan?: string;
    glutenFree?: string;
    spicy?: string;
    moreInfo?: string;
  };
};

export function DietaryLegend({ labels = {} }: DietaryLegendProps) {
  const locale = useLocale();
  const menuAllergenUrl = `/${locale}/menu#allergen-info`;

  return (
    <Link
      href={menuAllergenUrl}
      style={{
        display: "block",
        padding: "12px 16px",
        background: "#f9fafb",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        marginTop: 24,
        textDecoration: "none",
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {/* Vegetarian */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Image
            src="/allergens/vegetarian.png"
            alt={labels.vegetarian || "Vegetarian"}
            width={20}
            height={20}
            style={{ objectFit: "contain" }}
          />
          <span style={{ fontSize: "0.8rem", color: "#666" }}>
            {labels.vegetarian || "Vegetarian"}
          </span>
        </div>

        {/* Vegan */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Image
            src="/allergens/vegan.png"
            alt={labels.vegan || "Vegan"}
            width={20}
            height={20}
            style={{ objectFit: "contain" }}
          />
          <span style={{ fontSize: "0.8rem", color: "#666" }}>
            {labels.vegan || "Vegan"}
          </span>
        </div>

        {/* Gluten-Free */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Image
            src="/allergens/gluten-free.png"
            alt={labels.glutenFree || "Gluten-Free"}
            width={20}
            height={20}
            style={{ objectFit: "contain" }}
          />
          <span style={{ fontSize: "0.8rem", color: "#666" }}>
            {labels.glutenFree || "Gluten-Free"}
          </span>
        </div>

        {/* Spicy */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "2px 6px",
              fontSize: "0.7rem",
              fontWeight: 700,
              borderRadius: 4,
              background: "#fef2f2",
              color: "#dc2626",
            }}
          >
            🌶️
          </span>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>
            {labels.spicy || "Spicy"}
          </span>
        </div>
      </div>

      {/* More info link indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginTop: 8,
          fontSize: "0.75rem",
          color: "#7C7A67",
        }}
      >
        <span>{labels.moreInfo || "Tap for allergen information"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
