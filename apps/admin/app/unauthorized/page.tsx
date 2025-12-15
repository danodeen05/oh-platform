import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export default function UnauthorizedPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          fontSize: "4rem",
          marginBottom: "16px",
        }}
      >
        🔒
      </div>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 600,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Access Denied
      </h1>
      <p
        style={{
          color: "#6b7280",
          fontSize: "1.1rem",
          maxWidth: "400px",
          marginBottom: "24px",
        }}
      >
        Your account does not have permission to access the admin portal.
        Please contact an administrator if you believe this is an error.
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <SignOutButton>
          <button
            style={{
              padding: "10px 20px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </SignOutButton>
        <Link
          href="https://ohbeef.com"
          style={{
            padding: "10px 20px",
            background: "#f3f4f6",
            color: "#374151",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Go to Main Site
        </Link>
      </div>
    </div>
  );
}
