"use client";

import Link from "next/link";

// Location data - will be replaced with API data
const locations = [
  {
    id: "flagship",
    name: "Oh! Flagship",
    city: "San Francisco",
    area: "SOMA District",
    address: "123 Innovation Way",
    state: "CA",
    zipCode: "94105",
    phone: "(415) 555-0123",
    status: "Coming Soon",
    openingDate: "Spring 2025",
    features: ["Private Dining Pods", "Tech-Enabled Ordering", "Premium Seating"],
    hours: {
      weekday: "11:00 AM - 10:00 PM",
      weekend: "10:00 AM - 11:00 PM",
    },
    description: "Our flagship location featuring 24 private dining pods, state-of-the-art ordering technology, and the full Oh! experience.",
    image: "/locations/sf-flagship.jpg",
  },
];

// Expansion cities
const upcomingCities = [
  { city: "Los Angeles", state: "CA", target: "2025" },
  { city: "Seattle", state: "WA", target: "2025" },
  { city: "Austin", state: "TX", target: "2026" },
  { city: "New York", state: "NY", target: "2026" },
  { city: "Chicago", state: "IL", target: "2026" },
];

export default function LocationsPage() {
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
          Our Locations
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: "1.8",
            opacity: 0.9,
            fontWeight: "300",
          }}
        >
          Experience Oh! in person. Find a location near you or discover where we&apos;re opening next.
        </p>
      </section>

      {/* Current Locations */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 24px" }}>
        <h2
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: "400",
            color: "#222222",
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          Flagship Location
        </h2>

        {locations.map((location) => (
          <div
            key={location.id}
            style={{
              background: "white",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              marginBottom: "32px",
            }}
          >
            {/* Location Image/Map Placeholder */}
            <div
              style={{
                height: "300px",
                background: "linear-gradient(135deg, #7C7A67 0%, #222222 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div style={{ textAlign: "center", color: "#E5E5E5" }}>
                <span style={{ fontSize: "4rem", marginBottom: "16px", display: "block" }}>📍</span>
                <span style={{ fontSize: "1.2rem", opacity: 0.9 }}>{location.city}, {location.state}</span>
              </div>

              {/* Status Badge */}
              <div
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  background: "#C7A878",
                  color: "#222222",
                  padding: "8px 20px",
                  borderRadius: "20px",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                }}
              >
                {location.status}
              </div>
            </div>

            {/* Location Details */}
            <div style={{ padding: "32px" }}>
              <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                {/* Main Info */}
                <div>
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
                    {location.area}
                  </p>
                  <h3
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: "500",
                      color: "#222222",
                      marginBottom: "16px",
                    }}
                  >
                    {location.name}
                  </h3>
                  <p style={{ color: "#666", lineHeight: "1.6", marginBottom: "16px" }}>
                    {location.description}
                  </p>

                  {/* Features */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
                    {location.features.map((feature, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: "rgba(124, 122, 103, 0.1)",
                          color: "#7C7A67",
                          padding: "6px 14px",
                          borderRadius: "16px",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contact & Hours */}
                <div>
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
                      Address
                    </h4>
                    <p style={{ color: "#666", lineHeight: "1.6" }}>
                      {location.address}<br />
                      {location.city}, {location.state} {location.zipCode}
                    </p>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
                      Opening
                    </h4>
                    <p style={{ color: "#C7A878", fontWeight: "600", fontSize: "1.1rem" }}>
                      {location.openingDate}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#222222", marginBottom: "12px" }}>
                      Hours (Planned)
                    </h4>
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>
                      Mon - Fri: {location.hours.weekday}<br />
                      Sat - Sun: {location.hours.weekend}
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div
                style={{
                  marginTop: "32px",
                  paddingTop: "24px",
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/order"
                  style={{
                    padding: "14px 32px",
                    background: "#7C7A67",
                    color: "white",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: "500",
                    transition: "all 0.3s ease",
                  }}
                >
                  Pre-Order Now
                </Link>
                <button
                  style={{
                    padding: "14px 32px",
                    background: "transparent",
                    color: "#7C7A67",
                    border: "2px solid #7C7A67",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500",
                    transition: "all 0.3s ease",
                  }}
                >
                  Get Notified
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Expansion Plans */}
      <section
        style={{
          background: "white",
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "16px",
            }}
          >
            Coming to Your City
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "48px",
              maxWidth: "600px",
              margin: "0 auto 48px",
            }}
          >
            We&apos;re expanding across the country. Sign up to be the first to know when Oh! opens near you.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            {upcomingCities.map((city, idx) => (
              <div
                key={idx}
                style={{
                  background: "#f9fafb",
                  padding: "24px",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#7C7A67";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222222", marginBottom: "4px" }}>
                  {city.city}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#7C7A67" }}>
                  {city.state} • {city.target}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Experience Section */}
      <section
        style={{
          background: "#222222",
          color: "#E5E5E5",
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              marginBottom: "48px",
              textAlign: "center",
              letterSpacing: "2px",
            }}
          >
            What to Expect
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "40px",
            }}
          >
            <div>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  background: "rgba(199, 168, 120, 0.2)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  fontSize: "1.8rem",
                }}
              >
                🏠
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px" }}>
                Private Dining Pods
              </h3>
              <p style={{ fontSize: "0.95rem", opacity: 0.8, lineHeight: "1.7" }}>
                Inspired by Japanese solo dining concepts. Individual cubicles designed for focused,
                distraction-free enjoyment of your meal. Perfect for solo diners or those who want a moment of peace.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  background: "rgba(199, 168, 120, 0.2)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  fontSize: "1.8rem",
                }}
              >
                📱
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px" }}>
                Seamless Technology
              </h3>
              <p style={{ fontSize: "0.95rem", opacity: 0.8, lineHeight: "1.7" }}>
                Order ahead through our app. Your bowl is prepared and ready when you arrive.
                No waiting in line, no flagging down servers. Just you and your perfect soup.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  background: "rgba(199, 168, 120, 0.2)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  fontSize: "1.8rem",
                }}
              >
                ✨
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px" }}>
                Automated Service
              </h3>
              <p style={{ fontSize: "0.95rem", opacity: 0.8, lineHeight: "1.7" }}>
                Our automated delivery system brings your meal directly to your pod.
                Minimal human interaction means maximum focus on the incredible flavors in front of you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section
        style={{
          background: "#C7A878",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "500px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "400",
              color: "#222222",
              marginBottom: "16px",
            }}
          >
            Stay in the Loop
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "#222222",
              marginBottom: "24px",
              opacity: 0.8,
            }}
          >
            Be the first to know about new locations, special offers, and exclusive events.
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
                background: "#222222",
                color: "#E5E5E5",
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
    </div>
  );
}
