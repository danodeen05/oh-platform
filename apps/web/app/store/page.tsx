"use client";

import Link from "next/link";

const products = [
  {
    id: "instant-noodle-kit",
    name: "Oh! Home Kit",
    category: "Food",
    description: "Everything you need to make our signature beef noodle soup at home. Includes broth base, noodles, and spice packets.",
    price: "$34.99",
    badge: "Best Seller",
    available: false,
  },
  {
    id: "chili-oil",
    name: "Signature Chili Oil",
    category: "Condiments",
    description: "Our house-made chili oil with Szechuan peppercorns. Perfect for adding heat to any dish.",
    price: "$14.99",
    badge: null,
    available: false,
  },
  {
    id: "broth-concentrate",
    name: "Beef Bone Broth Concentrate",
    category: "Food",
    description: "Rich, concentrated beef broth made from our 48-hour recipe. Just add water for restaurant-quality broth.",
    price: "$24.99",
    badge: "New",
    available: false,
  },
  {
    id: "ramen-bowl",
    name: "Oh! Ceramic Bowl",
    category: "Merchandise",
    description: "Premium ceramic bowl designed for the perfect noodle experience. Heat-retaining, hand-glazed.",
    price: "$42.00",
    badge: null,
    available: false,
  },
  {
    id: "chopsticks-set",
    name: "Premium Chopstick Set",
    category: "Merchandise",
    description: "Handcrafted wooden chopsticks with matching rest. Comes in a beautiful gift box.",
    price: "$28.00",
    badge: null,
    available: false,
  },
  {
    id: "tshirt",
    name: "Oh! Classic Tee",
    category: "Apparel",
    description: "Soft cotton tee with our signature logo. Available in black and white.",
    price: "$32.00",
    badge: null,
    available: false,
  },
  {
    id: "hoodie",
    name: "Oh! Comfort Hoodie",
    category: "Apparel",
    description: "Premium heavyweight hoodie with embroidered logo. Perfect for cozy soup weather.",
    price: "$68.00",
    badge: null,
    available: false,
  },
  {
    id: "apron",
    name: "Chef's Apron",
    category: "Merchandise",
    description: "Canvas apron with leather straps and our logo. For the home chef who takes noodles seriously.",
    price: "$45.00",
    badge: null,
    available: false,
  },
];

const categories = ["All", "Food", "Condiments", "Merchandise", "Apparel"];

export default function StorePage() {
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
          The Oh! Store
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: "1.8",
            fontWeight: "300",
            color: "#C7A878",
          }}
        >
          Bring the Oh! experience home. From at-home kits to premium merchandise, find everything you need to fuel your noodle obsession.
        </p>
      </section>

      {/* Coming Soon Banner */}
      <section
        style={{
          background: "#C7A878",
          padding: "20px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#222222", fontWeight: "500", margin: 0 }}>
          🚀 Online store launching soon! Sign up below to be notified.
        </p>
      </section>

      {/* Category Filter */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px 0" }}>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {categories.map((category) => (
            <button
              key={category}
              style={{
                padding: "10px 24px",
                background: category === "All" ? "#7C7A67" : "white",
                color: category === "All" ? "white" : "#7C7A67",
                border: "1px solid #7C7A67",
                borderRadius: "24px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
                transition: "all 0.2s ease",
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Products Grid */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                background: "white",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                opacity: product.available ? 1 : 0.8,
              }}
            >
              {/* Product Image Placeholder */}
              <div
                style={{
                  height: "220px",
                  background: "linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <span style={{ fontSize: "4rem", opacity: 0.3 }}>
                  {product.category === "Food" || product.category === "Condiments" ? "🍜" :
                   product.category === "Apparel" ? "👕" : "🥢"}
                </span>

                {/* Badge */}
                {product.badge && (
                  <span
                    style={{
                      position: "absolute",
                      top: "12px",
                      left: "12px",
                      background: product.badge === "Best Seller" ? "#7C7A67" :
                                 product.badge === "New" ? "#C7A878" : "#222222",
                      color: "white",
                      padding: "6px 14px",
                      borderRadius: "16px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    {product.badge}
                  </span>
                )}

                {/* Coming Soon Overlay */}
                {!product.available && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      right: "12px",
                      background: "rgba(34, 34, 34, 0.9)",
                      color: "#E5E5E5",
                      padding: "6px 14px",
                      borderRadius: "16px",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                    }}
                  >
                    Coming Soon
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div style={{ padding: "20px" }}>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#C7A878",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "8px",
                    fontWeight: "500",
                  }}
                >
                  {product.category}
                </p>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#222222",
                    marginBottom: "8px",
                  }}
                >
                  {product.name}
                </h3>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "#666",
                    lineHeight: "1.5",
                    marginBottom: "16px",
                  }}
                >
                  {product.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "600",
                      color: "#7C7A67",
                    }}
                  >
                    {product.price}
                  </span>
                  <button
                    disabled={!product.available}
                    style={{
                      padding: "10px 20px",
                      background: product.available ? "#7C7A67" : "#d1d5db",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: product.available ? "pointer" : "not-allowed",
                      fontSize: "0.9rem",
                      fontWeight: "500",
                    }}
                  >
                    {product.available ? "Add to Cart" : "Notify Me"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter Section */}
      <section
        style={{
          background: "#222222",
          color: "#E5E5E5",
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "300",
              marginBottom: "16px",
              letterSpacing: "1px",
            }}
          >
            Be the First to Know
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              opacity: 0.9,
              marginBottom: "32px",
              lineHeight: "1.7",
            }}
          >
            Get early access to new products, exclusive drops, and member-only deals.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <input
              type="email"
              placeholder="your@email.com"
              style={{
                flex: "1 1 200px",
                maxWidth: "300px",
                padding: "14px 20px",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                outline: "none",
              }}
            />
            <button
              style={{
                padding: "14px 32px",
                background: "#C7A878",
                color: "#222222",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "1rem",
              }}
            >
              Notify Me
            </button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ background: "white", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "40px",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🚚</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "8px", color: "#222222" }}>
                Free Shipping
              </h3>
              <p style={{ color: "#666", fontSize: "0.95rem" }}>
                On all orders over $50
              </p>
            </div>
            <div>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🏆</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "8px", color: "#222222" }}>
                Member Rewards
              </h3>
              <p style={{ color: "#666", fontSize: "0.95rem" }}>
                Earn points on every purchase
              </p>
            </div>
            <div>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>💝</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "8px", color: "#222222" }}>
                Gift Wrapping
              </h3>
              <p style={{ color: "#666", fontSize: "0.95rem" }}>
                Complimentary on all orders
              </p>
            </div>
            <div>
              <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>↩️</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "8px", color: "#222222" }}>
                Easy Returns
              </h3>
              <p style={{ color: "#666", fontSize: "0.95rem" }}>
                30-day hassle-free returns
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
