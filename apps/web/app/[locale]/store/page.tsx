"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

export default function StorePage() {
  const t = useTranslations("store");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  const products = [
    {
      id: "home-kit",
      name: t("products.homeKit.name"),
      category: t("categories.food"),
      categoryKey: "Food",
      description: t("products.homeKit.description"),
      price: 34.99,
      badge: t("badges.bestSeller"),
      image: "/store/HomeKit.png",
    },
    {
      id: "chili-oil",
      name: t("products.chiliOil.name"),
      category: t("categories.condiments"),
      categoryKey: "Condiments",
      description: t("products.chiliOil.description"),
      price: 14.99,
      badge: null,
      image: "/store/SignatureChiliOil.png",
    },
    {
      id: "broth-concentrate",
      name: t("products.brothConcentrate.name"),
      category: t("categories.food"),
      categoryKey: "Food",
      description: t("products.brothConcentrate.description"),
      price: 24.99,
      badge: t("badges.new"),
      image: "/store/BeefBoneBrothConcentrate.png",
    },
    {
      id: "ceramic-bowl",
      name: t("products.ceramicBowl.name"),
      category: t("categories.merchandise"),
      categoryKey: "Merchandise",
      description: t("products.ceramicBowl.description"),
      price: 42.00,
      badge: null,
      image: "/store/CeramicBowl.png",
    },
    {
      id: "chopsticks",
      name: t("products.chopsticks.name"),
      category: t("categories.merchandise"),
      categoryKey: "Merchandise",
      description: t("products.chopsticks.description"),
      price: 28.00,
      badge: null,
      image: "/store/Chopsticks.png",
    },
    {
      id: "tshirt",
      name: t("products.tshirt.name"),
      category: t("categories.apparel"),
      categoryKey: "Apparel",
      description: t("products.tshirt.description"),
      price: 32.00,
      badge: null,
      image: "/store/T-Shirt.png",
    },
    {
      id: "hoodie",
      name: t("products.hoodie.name"),
      category: t("categories.apparel"),
      categoryKey: "Apparel",
      description: t("products.hoodie.description"),
      price: 68.00,
      badge: null,
      image: "/store/ComfortHoodie.png",
    },
    {
      id: "apron",
      name: t("products.apron.name"),
      category: t("categories.merchandise"),
      categoryKey: "Merchandise",
      description: t("products.apron.description"),
      price: 45.00,
      badge: null,
      image: "/store/ChefsApron.png",
    },
    {
      id: "wooden-bowl",
      name: t("products.woodenBowl.name"),
      category: t("categories.limitedEdition"),
      categoryKey: "Limited Edition",
      description: t("products.woodenBowl.description"),
      price: 145.00,
      badge: t("badges.limited"),
      image: "/store/ArtisanWoodenSoupBowl.png",
    },
  ];

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

      {/* Coming Soon Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, #C7A878 0%, #a08860 100%)",
          padding: "24px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#222222", fontWeight: "500", margin: 0, fontSize: "1.05rem" }}>
          {t("launchingSoon")}
        </p>
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

                {/* Coming Soon Overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    right: "16px",
                    background: "rgba(34, 34, 34, 0.9)",
                    color: "#E5E5E5",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    letterSpacing: "0.5px",
                  }}
                >
                  {tCommon("comingSoon")}
                </div>
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
                  <button
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
                    }}
                  >
                    {tCommon("notifyMe")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
      `}</style>
    </div>
  );
}
