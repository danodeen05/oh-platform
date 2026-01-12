"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useCart } from "@/contexts/cart-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  nameZhTW?: string;
  nameZhCN?: string;
  nameEs?: string;
  description?: string;
  descriptionZhTW?: string;
  descriptionZhCN?: string;
  descriptionEs?: string;
  priceCents: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
  stockCount?: number;
}

// Map API category to display category key
const categoryMap: Record<string, string> = {
  FOOD: "Food",
  CONDIMENTS: "Condiments",
  MERCHANDISE: "Merchandise",
  APPAREL: "Apparel",
  LIMITED_EDITION: "Limited Edition",
};

export default function StorePage() {
  const t = useTranslations("store");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { addItem, updateQuantity, getItemQuantity } = useCart();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [apiProducts, setApiProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch products from API
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${API_URL}/shop/products`);
        if (res.ok) {
          const data = await res.json();
          setApiProducts(Array.isArray(data) ? data.filter((p: ShopProduct) => p.isAvailable) : []);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      }
      setLoading(false);
    }
    fetchProducts();
  }, []);

  // Get localized name based on current locale
  const getLocalizedName = (product: ShopProduct): string => {
    if (locale === "zh-TW" && product.nameZhTW) return product.nameZhTW;
    if (locale === "zh-CN" && product.nameZhCN) return product.nameZhCN;
    if (locale === "es" && product.nameEs) return product.nameEs;
    return product.name;
  };

  // Get localized description based on current locale
  const getLocalizedDescription = (product: ShopProduct): string => {
    if (locale === "zh-TW" && product.descriptionZhTW) return product.descriptionZhTW;
    if (locale === "zh-CN" && product.descriptionZhCN) return product.descriptionZhCN;
    if (locale === "es" && product.descriptionEs) return product.descriptionEs;
    return product.description || "";
  };

  // Get localized category label
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      Food: t("categories.food"),
      Condiments: t("categories.condiments"),
      Merchandise: t("categories.merchandise"),
      Apparel: t("categories.apparel"),
      "Limited Edition": t("categories.limitedEdition"),
    };
    return labels[category] || category;
  };

  // Get badge for product (based on category or stock)
  const getBadge = (product: ShopProduct): string | null => {
    if (product.category === "LIMITED_EDITION") return t("badges.limited");
    if (product.stockCount !== null && product.stockCount !== undefined && product.stockCount < 10) return t("badges.limited");
    // You could add more badge logic here based on product data
    return null;
  };

  // Transform API products to display format
  const products = apiProducts.map((p) => ({
    id: p.slug,
    dbId: p.id,
    name: getLocalizedName(p),
    category: getCategoryLabel(categoryMap[p.category] || p.category),
    categoryKey: categoryMap[p.category] || p.category,
    description: getLocalizedDescription(p),
    price: p.priceCents / 100,
    priceCents: p.priceCents,
    badge: getBadge(p),
    image: p.imageUrl || "/store/placeholder.png",
  }));

  const categories = [
    { key: "All", label: t("categories.all") },
    { key: "Food", label: t("categories.food") },
    { key: "Condiments", label: t("categories.condiments") },
    { key: "Merchandise", label: t("categories.merchandise") },
    { key: "Apparel", label: t("categories.apparel") },
    { key: "Limited Edition", label: t("categories.limitedEdition") },
  ];

  const filteredProducts = selectedCategory === "All"
    ? products
    : products.filter(p => p.categoryKey === selectedCategory);

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          position: "relative",
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #222222 0%, #333333 50%, #faf9f7 100%)",
          padding: "120px 24px 100px",
          overflow: "hidden",
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "10%",
            width: "250px",
            height: "250px",
            background: "radial-gradient(circle, rgba(199, 168, 120, 0.1) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "30%",
            right: "15%",
            width: "180px",
            height: "180px",
            background: "radial-gradient(circle, rgba(124, 122, 103, 0.1) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        <div style={{ maxWidth: "800px", textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Large Logo */}
          <div
            style={{
              position: "relative",
              width: "180px",
              height: "180px",
              margin: "0 auto 32px",
              animation: "float 4s ease-in-out infinite",
            }}
          >
            <Image
              src="/Oh_Logo_Large.png"
              alt="Oh!"
              fill
              sizes="180px"
              style={{
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
                opacity: 0.95,
              }}
            />
          </div>

          <p
            style={{
              fontSize: "0.9rem",
              textTransform: "uppercase",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "16px",
              fontWeight: "500",
            }}
          >
            {t("tagline")}
          </p>
          <h1
            style={{
              fontSize: "clamp(2rem, 6vw, 3.5rem)",
              fontWeight: "300",
              marginBottom: "24px",
              letterSpacing: "3px",
              color: "white",
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
              maxWidth: "600px",
              margin: "0 auto",
              lineHeight: "1.8",
              fontWeight: "300",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            {t("description")}
          </p>

          {/* Scroll indicator */}
          <div
            style={{
              marginTop: "60px",
              color: "rgba(255,255,255,0.5)",
              animation: "bounce 2s infinite",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 0" }}>
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {categories.map((category) => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              style={{
                padding: "12px 28px",
                background: selectedCategory === category.key ? "#7C7A67" : "white",
                color: selectedCategory === category.key ? "white" : "#7C7A67",
                border: "2px solid #7C7A67",
                borderRadius: "30px",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: "500",
                transition: "all 0.3s ease",
                boxShadow: selectedCategory === category.key
                  ? "0 4px 12px rgba(124, 122, 103, 0.3)"
                  : "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      {/* Products Grid */}
      <section style={{ maxWidth: "1300px", margin: "0 auto", padding: "48px 24px 100px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "3px solid #e5e7eb",
                borderTopColor: "#7C7A67",
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ color: "#666", fontSize: "1rem" }}>Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <p style={{ color: "#666", fontSize: "1.1rem" }}>No products found in this category.</p>
          </div>
        ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "32px",
          }}
        >
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
              style={{
                background: "white",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: hoveredProduct === product.id
                  ? "0 20px 40px rgba(0, 0, 0, 0.15)"
                  : "0 4px 20px rgba(0, 0, 0, 0.08)",
                transition: "all 0.4s ease",
                transform: hoveredProduct === product.id ? "translateY(-8px)" : "translateY(0)",
              }}
            >
              {/* Product Image */}
              <div
                style={{
                  position: "relative",
                  height: "320px",
                  background: "linear-gradient(135deg, #f8f8f6 0%, #eeeee8 100%)",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{
                    objectFit: "cover",
                    transition: "transform 0.5s ease",
                    transform: hoveredProduct === product.id ? "scale(1.05)" : "scale(1)",
                  }}
                />

                {/* Badge */}
                {product.badge && (
                  <span
                    style={{
                      position: "absolute",
                      top: "16px",
                      left: "16px",
                      background: product.badge === t("badges.bestSeller") ? "#7C7A67" : product.badge === t("badges.limited") ? "#222222" : "#C7A878",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {product.badge}
                  </span>
                )}

              </div>

              {/* Product Info */}
              <div style={{ padding: "28px" }}>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#C7A878",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    marginBottom: "10px",
                    fontWeight: "600",
                  }}
                >
                  {product.category}
                </p>
                <h3
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "600",
                    color: "#222222",
                    marginBottom: "12px",
                  }}
                >
                  {product.name}
                </h3>
                <p
                  style={{
                    fontSize: "0.95rem",
                    color: "#666",
                    lineHeight: "1.6",
                    marginBottom: "20px",
                    minHeight: "48px",
                  }}
                >
                  {product.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "16px",
                    borderTop: "1px solid #eee",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: "600",
                      color: "#7C7A67",
                    }}
                  >
                    ${product.price.toFixed(2)}
                  </span>
                  {getItemQuantity(product.id) === 0 ? (
                    <button
                      onClick={() => {
                        addItem({
                          id: product.id,
                          slug: product.id,
                          name: product.name,
                          priceCents: Math.round(product.price * 100),
                          imageUrl: product.image,
                        });
                      }}
                      style={{
                        padding: "12px 24px",
                        background: "#7C7A67",
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        transition: "all 0.3s ease",
                        boxShadow: "0 4px 12px rgba(124, 122, 103, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      Add to Cart
                    </button>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "#f5f5f5",
                        borderRadius: "10px",
                        padding: "4px",
                      }}
                    >
                      <button
                        onClick={() => updateQuantity(product.id, getItemQuantity(product.id) - 1)}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#7C7A67",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "1.2rem",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          minWidth: "40px",
                          textAlign: "center",
                          fontSize: "1rem",
                          fontWeight: "600",
                          color: "#222",
                        }}
                      >
                        {getItemQuantity(product.id)}
                      </span>
                      <button
                        onClick={() => {
                          addItem({
                            id: product.id,
                            slug: product.id,
                            name: product.name,
                            priceCents: Math.round(product.price * 100),
                            imageUrl: product.image,
                          });
                        }}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#7C7A67",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "1.2rem",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      {/* Why Shop Oh! Section - The Oh! Way style */}
      <section style={{ background: "#222", color: "white", padding: "100px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.85rem",
              textTransform: "uppercase",
              letterSpacing: "4px",
              color: "#C7A878",
              marginBottom: "20px",
            }}
          >
            {t("whyShop.title")}
          </p>
          <h2
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: "300",
              marginBottom: "60px",
              lineHeight: "1.3",
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {t("whyShop.subtitle")}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "48px",
              textAlign: "center",
            }}
          >
            {[
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="3" width="15" height="13" rx="2" />
                    <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-5" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                ),
                title: t("whyShop.freeShipping.title"),
                desc: t("whyShop.freeShipping.description"),
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                ),
                title: t("whyShop.useCredit.title"),
                desc: t("whyShop.useCredit.description"),
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ),
                title: t("whyShop.memberRewards.title"),
                desc: t("whyShop.memberRewards.description"),
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 12h4l3-9 4 18 3-9h4" />
                  </svg>
                ),
                title: t("whyShop.easyReturns.title"),
                desc: t("whyShop.easyReturns.description"),
              },
            ].map((feature, idx) => (
              <div key={idx}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    background: "rgba(199, 168, 120, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    color: "#C7A878",
                  }}
                >
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px", color: "rgba(255,255,255,0.95)" }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section style={{ background: "#faf9f7", padding: "100px 24px" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#C7A878",
              textTransform: "uppercase",
              letterSpacing: "3px",
              marginBottom: "12px",
              fontWeight: "600",
            }}
          >
            {t("newsletter.tagline")}
          </p>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "400",
              color: "#222",
              marginBottom: "16px",
              lineHeight: "1.2",
            }}
          >
            {t("newsletter.title")}
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "32px",
              lineHeight: "1.7",
            }}
          >
            {t("newsletter.description")}
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <input
              type="email"
              placeholder={t("newsletter.placeholder")}
              style={{
                flex: "1 1 200px",
                maxWidth: "300px",
                padding: "16px 24px",
                border: "2px solid #e5e7eb",
                borderRadius: "12px",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
            />
            <button
              style={{
                padding: "16px 40px",
                background: "#7C7A67",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "1rem",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 12px rgba(124, 122, 103, 0.3)",
              }}
            >
              {tCommon("notifyMe")}
            </button>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          background: "linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: "400",
              color: "white",
              marginBottom: "24px",
            }}
          >
            {t("cta.title")}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "32px", fontSize: "1.1rem" }}>
            {t("cta.description")}
          </p>
          <Link
            href={`/${locale}/locations`}
            style={{
              display: "inline-block",
              padding: "18px 48px",
              background: "white",
              color: "#7C7A67",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "1.1rem",
              transition: "all 0.3s ease",
            }}
          >
            {tCommon("findLocation")}
          </Link>
        </div>
      </section>

      <style jsx>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
