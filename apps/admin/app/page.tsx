import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "48px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt="Oh!"
          style={{ height: "56px", width: "auto" }}
        />
        <h1 style={{ fontSize: "2.5rem", margin: 0 }}>
          Admin Portal
        </h1>
      </div>
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

        <Link
          href="/cleaning"
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
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🧹</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Cleaning</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>
            Track pod cleaning and customer service
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
            Manage restaurant locations
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
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Menu Management</h2>
          <p style={{ color: "#666", fontSize: "0.95rem" }}>
            Add, edit, and manage menu items
          </p>
        </Link>

        <Link
          href="/analytics"
          style={{
            padding: "32px",
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            border: "2px solid #1e40af",
            borderRadius: "12px",
            textDecoration: "none",
            color: "white",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📊</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Analytics Dashboard</h2>
          <p style={{ opacity: 0.9, fontSize: "0.95rem" }}>
            Revenue, operations, customers, and menu insights
          </p>
        </Link>
      </div>
    </main>
  );
}
