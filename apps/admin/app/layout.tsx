import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          margin: 0,
          background: "#f9fafb",
          minHeight: "100vh",
        }}
      >
        <nav
          style={{
            background: "white",
            borderBottom: "1px solid #e5e7eb",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <Link
              href="/"
              style={{
                fontWeight: 700,
                fontSize: "1.25rem",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              Oh Admin
            </Link>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link
                href="/kitchen"
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "#4b5563",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Kitchen
              </Link>
              <Link
                href="/pods"
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "#4b5563",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Pods
              </Link>
              <Link
                href="/pods/config"
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "#ec4899",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Pod Config
              </Link>
              <Link
                href="/analytics"
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "#2563eb",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "#eff6ff",
                }}
              >
                Analytics
              </Link>
              <Link
                href="/menu"
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "#4b5563",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Menu
              </Link>
              <Link
                href="/locations"
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: "#4b5563",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Locations
              </Link>
            </div>
          </div>
        </nav>
        <main style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
