import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <ClerkProvider>
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
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textDecoration: "none",
                }}
              >
                <img
                  src="/Oh_Logo_Mark_Web.png"
                  alt="Oh!"
                  style={{ height: "32px", width: "auto" }}
                />
                <span style={{
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: "#6b7280",
                  letterSpacing: "0.5px",
                }}>
                  Admin
                </span>
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
                  href="/cleaning"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  Cleaning
                </Link>
                <Link
                  href="/cleaning/config"
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
            {/* Auth section - only show in production */}
            {!isDev && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button
                      style={{
                        padding: "8px 16px",
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Sign In
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            )}
          </nav>
          <main style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
