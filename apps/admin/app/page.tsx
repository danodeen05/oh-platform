import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "48px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
        Oh Platform Admin
      </h1>
      <p style={{ color: "#666", marginBottom: "48px", fontSize: "1.1rem" }}>
        Manage your restaurant operations
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
        }}
      >
        <Link
          href="/tenants"
          style={{
            padding: "32px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🏢</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Tenants</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>
            Manage restaurant tenants and subscriptions
          </p>
        </Link>

        <Link
          href="/locations"
          style={{
            padding: "32px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📍</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Locations</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>
            Manage restaurant locations and seating
          </p>
        </Link>

        <Link
          href="/menu"
          style={{
            padding: "32px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🍜</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Menu</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>
            Manage menu items and pricing
          </p>
        </Link>

        <Link
          href="/kitchen"
          style={{
            padding: "32px",
            background: "white",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            textDecoration: "none",
            color: "inherit",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>👨‍🍳</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Kitchen Display</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>
            View and manage incoming orders
          </p>
        </Link>
      </div>
    </main>
  );
}
