"use client";
import Link from "next/link";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "4rem",
          marginBottom: "24px",
        }}
      >
        🍜
      </div>
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: "bold",
          color: "#222222",
          marginBottom: "16px",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#7C7A67",
          marginBottom: "8px",
        }}
      >
        Coming Soon
      </p>
      {description && (
        <p
          style={{
            fontSize: "1rem",
            color: "#666",
            maxWidth: "400px",
            marginBottom: "32px",
          }}
        >
          {description}
        </p>
      )}
      <Link
        href="/order"
        style={{
          display: "inline-block",
          padding: "14px 32px",
          background: "#7C7A67",
          color: "white",
          textDecoration: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          fontSize: "1rem",
          transition: "background 0.3s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#5a5847")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#7C7A67")}
      >
        Order Now
      </Link>
    </div>
  );
}
