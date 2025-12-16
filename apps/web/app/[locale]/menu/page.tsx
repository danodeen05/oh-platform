"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getMenuItemImage, isNoNoodlesItem } from "@/lib/menu-images";
import { useTranslations, useLocale } from "next-intl";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Types from the API
type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  additionalPriceCents: number;
  includedQuantity: number;
  category?: string;
  categoryType?: string;
  selectionMode?: string;
  description?: string;
  sliderConfig?: {
    min: number;
    max: number;
    default: number;
    labels: string[];
    step: number;
    description?: string;
  };
  isAvailable: boolean;
};

type MenuSection = {
  id: string;
  name: string;
  description?: string;
  selectionMode: string;
  required: boolean;
  items?: MenuItem[];
  sliderConfig?: {
    min: number;
    max: number;
    default: number;
    labels: string[];
    step: number;
    description?: string;
  };
  item?: MenuItem;
  maxQuantity?: number;
};

type MenuStep = {
  id: string;
  title: string;
  sections: MenuSection[];
};

// Helper to format price
function formatPrice(cents: number, includedText: string): string {
  if (cents === 0) return includedText;
  return `$${(cents / 100).toFixed(2)}`;
}

// Map API steps to display sections
type DisplaySection = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  items: {
    name: string;
    description: string;
    price: string;
    tags: string[];
  }[];
};

function mapStepsToDisplaySections(steps: MenuStep[], t: (key: string) => string): DisplaySection[] {
  const sections: DisplaySection[] = [];

  for (const step of steps) {
    for (const section of step.sections) {
      // Skip slider sections - they're customization options, not menu items
      // Skip Beverages section - not needed on menu page
      if (section.selectionMode === "SLIDER") continue;
      if (section.name === "Beverages") continue;

      const items = (section.items || [])
        .filter((item) => item.isAvailable && item.name !== "No Noodles")
        .map((item) => {
          const tags: string[] = [];

          // Add tags based on item characteristics
          if (item.name.includes("A5 Wagyu")) tags.push(t("tags.premium"));
          if (item.name.includes("Classic") && item.category === "main01") tags.push(t("tags.signature"));
          if (item.basePriceCents === 0 && item.categoryType !== "MAIN") tags.push(t("tags.included"));
          if (item.description?.toLowerCase().includes("unlimited")) tags.push(t("tags.unlimitedRefills"));
          if (item.description?.toLowerCase().includes("complimentary")) tags.push(t("tags.complimentary"));

          return {
            name: item.name,
            description: item.description || "",
            price: item.basePriceCents === 0 ? t("tags.included") : formatPrice(item.basePriceCents, t("tags.included")),
            tags,
          };
        });

      if (items.length > 0) {
        // Generate subtitle based on section type
        let subtitle = "";
        let description = "";

        switch (section.name) {
          case "Choose Your Soup":
            subtitle = t("sections.soup.subtitle");
            description = t("sections.soup.description");
            break;
          case "Choose Your Noodles":
            subtitle = t("sections.noodles.subtitle");
            description = t("sections.noodles.description");
            break;
          case "Premium Add-ons":
            subtitle = t("sections.premiumAddons.subtitle");
            description = t("sections.premiumAddons.description");
            break;
          case "Side Dishes":
            subtitle = t("sections.sideDishes.subtitle");
            description = t("sections.sideDishes.description");
            break;
          case "Dessert":
            subtitle = t("sections.dessert.subtitle");
            description = t("sections.dessert.description");
            break;
          default:
            subtitle = section.name;
            description = section.description || "";
        }

        sections.push({
          id: section.id,
          title: section.name,
          subtitle,
          description,
          items,
        });
      }
    }
  }

  return sections;
}

// Extract customization options from slider sections
function getCustomizations(steps: MenuStep[]): { name: string; options: string[]; description: string }[] {
  const customizations: { name: string; options: string[]; description: string }[] = [];

  for (const step of steps) {
    for (const section of step.sections) {
      if (section.selectionMode === "SLIDER" && section.sliderConfig) {
        customizations.push({
          name: section.name,
          options: section.sliderConfig.labels,
          description: section.sliderConfig.description || section.description || "",
        });
      }
    }
  }

  return customizations;
}

export default function MenuPage() {
  const t = useTranslations("menu");
  const locale = useLocale();
  const [menuSections, setMenuSections] = useState<DisplaySection[]>([]);
  const [customizations, setCustomizations] = useState<{ name: string; options: string[]; description: string }[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMenu() {
      try {
        const response = await fetch(`${BASE}/menu/steps`, {
          headers: { "x-tenant-slug": "oh" },
        });

        if (!response.ok) {
          throw new Error(t("error.failedToLoad"));
        }

        const data = await response.json();
        const sections = mapStepsToDisplaySections(data.steps, t);
        const customs = getCustomizations(data.steps);

        setMenuSections(sections);
        setCustomizations(customs);

        if (sections.length > 0) {
          setActiveSection(sections[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("error.failedToLoad"));
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, [t]);

  if (loading) {
    return (
      <div style={{ background: "#E5E5E5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🍜</div>
          <p style={{ color: "#7C7A67", fontSize: "1.1rem" }}>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#E5E5E5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>😔</div>
          <h2 style={{ color: "#222222", marginBottom: "8px" }}>{t("error.title")}</h2>
          <p style={{ color: "#666", marginBottom: "24px" }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 32px",
              background: "#7C7A67",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {t("error.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#E5E5E5", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(180deg, #222222 0%, #333333 100%)",
          color: "#E5E5E5",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            fontWeight: "300",
            marginBottom: "16px",
            letterSpacing: "2px",
            color: "#E5E5E5",
          }}
        >
          {t("hero.title")}
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "600px",
            margin: "0 auto 32px",
            lineHeight: "1.8",
            fontWeight: "300",
            color: "#C7A878",
          }}
        >
          {t("hero.description")}
        </p>
        <Link
          href={`/${locale}/order`}
          style={{
            display: "inline-block",
            padding: "16px 48px",
            background: "#C7A878",
            color: "#222222",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
            letterSpacing: "1px",
            transition: "all 0.3s ease",
          }}
        >
          {t("hero.orderNow")}
        </Link>
      </section>

      {/* Navigation Tabs - Sticky */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          zIndex: 100,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "4px",
            padding: "12px 16px",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          {menuSections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{
                padding: "10px 20px",
                background: activeSection === section.id ? "#7C7A67" : "transparent",
                color: activeSection === section.id ? "white" : "#7C7A67",
                border: "1px solid #7C7A67",
                borderRadius: "24px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "500",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              {section.title}
            </button>
          ))}
        </div>
      </nav>


      {/* Menu Sections */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        {menuSections.map((section, sectionIndex) => (
          <section
            key={section.id}
            id={section.id}
            style={{
              padding: "48px 0",
              borderBottom: sectionIndex < menuSections.length - 1 ? "1px solid #e5e7eb" : "none",
            }}
          >
            {/* Section Header */}
            <div style={{ marginBottom: "32px" }}>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#C7A878",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                {section.subtitle}
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2rem)",
                  fontWeight: "400",
                  color: "#222222",
                  marginBottom: "12px",
                }}
              >
                {section.title}
              </h2>
              <p
                style={{
                  fontSize: "1rem",
                  color: "#666",
                  maxWidth: "600px",
                  lineHeight: "1.6",
                }}
              >
                {section.description}
              </p>
            </div>

            {/* Menu Items Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "24px",
              }}
            >
              {section.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
                  }}
                >
                  {/* Menu Item Image */}
                  <div
                    style={{
                      height: "180px",
                      background: "linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {getMenuItemImage(item.name) ? (
                      <Image
                        src={getMenuItemImage(item.name)!}
                        alt={item.name}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="(max-width: 768px) 100vw, 300px"
                      />
                    ) : isNoNoodlesItem(item.name) ? (
                      <>
                        <Image
                          src="/menu images/Ramen Noodles.png"
                          alt="No Noodles"
                          fill
                          style={{ objectFit: "cover", opacity: 0.4, filter: "grayscale(100%)" }}
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                        {/* Professional diagonal cross */}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "140%",
                              height: 6,
                              background: "#dc2626",
                              transform: "rotate(-45deg)",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "140%",
                              height: 6,
                              background: "#dc2626",
                              transform: "rotate(45deg)",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: "4rem", opacity: 0.3 }}>🍜</span>
                    )}
                    {/* Tags overlay */}
                    {item.tags.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          left: "12px",
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        {item.tags.map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            style={{
                              background: tag === "Signature" || tag === "Premium" ? "#C7A878" :
                                         tag === "Spicy" ? "#dc2626" :
                                         tag === "Most Popular" || tag === "Popular" ? "#7C7A67" :
                                         "rgba(255,255,255,0.9)",
                              color: tag === "Signature" || tag === "Premium" || tag === "Spicy" ||
                                     tag === "Most Popular" || tag === "Popular" ? "white" : "#222222",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "0.7rem",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "600",
                          color: "#222222",
                          margin: 0,
                        }}
                      >
                        {item.name}
                      </h3>
                      <span
                        style={{
                          fontSize: "1rem",
                          fontWeight: "600",
                          color: "#7C7A67",
                          whiteSpace: "nowrap",
                          marginLeft: "12px",
                        }}
                      >
                        {item.price}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "#666",
                        lineHeight: "1.5",
                        margin: 0,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* The Oh! Difference Section */}
      <section
        style={{
          background: "#222222",
          color: "#E5E5E5",
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              marginBottom: "24px",
              letterSpacing: "2px",
            }}
          >
            {t("difference.title")}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.8",
              marginBottom: "48px",
              maxWidth: "700px",
              margin: "0 auto 48px",
              color: "#C7A878",
            }}
          >
            {t("difference.description")}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "32px",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🎯</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "8px", color: "#C7A878" }}>
                {t("difference.techFirst.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "#C7A878" }}>
                {t("difference.techFirst.description")}
              </p>
            </div>

            <div>
              <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🏠</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "8px", color: "#C7A878" }}>
                {t("difference.privatePods.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "#C7A878" }}>
                {t("difference.privatePods.description")}
              </p>
            </div>

            <div>
              <div style={{ fontSize: "2rem", marginBottom: "16px" }}>⚡</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "8px", color: "#C7A878" }}>
                {t("difference.seamlessService.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "#C7A878" }}>
                {t("difference.seamlessService.description")}
              </p>
            </div>

            <div>
              <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🏆</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "8px", color: "#C7A878" }}>
                {t("difference.loyalty.title")}
              </h3>
              <p style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "#C7A878" }}>
                {t("difference.loyalty.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          background: "#C7A878",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: "400",
            color: "#222222",
            marginBottom: "16px",
          }}
        >
          {t("cta.title")}
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            color: "#222222",
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          {t("cta.description")}
        </p>
        <Link
          href={`/${locale}/order`}
          style={{
            display: "inline-block",
            padding: "16px 48px",
            background: "#222222",
            color: "#E5E5E5",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "500",
            letterSpacing: "1px",
            transition: "all 0.3s ease",
          }}
        >
          {t("cta.button")}
        </Link>
      </section>
    </div>
  );
}
