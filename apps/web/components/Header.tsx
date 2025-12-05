"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, UserButton } from "@clerk/nextjs";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      style={{
        background: "rgba(229, 229, 229, 0.95)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(124, 122, 103, 0.15)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <nav
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <Image
            src="/Oh_Logo_Mark_Web.png"
            alt="Oh Logo"
            width={70}
            height={70}
            style={{ display: "block" }}
          />
        </Link>

        {/* User Button */}
        <SignedIn>
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <UserButton />
          </div>
        </SignedIn>
      </nav>
    </header>
  );
}
