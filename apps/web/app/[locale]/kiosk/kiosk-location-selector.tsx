"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignOutButton } from "@clerk/nextjs";

type Location = {
  id: string;
  name: string;
  address: string;
  city: string;
};

const COLORS = {
  primary: "#7C7A67",
  primaryLight: "rgba(124, 122, 103, 0.15)",
  surface: "#FFFFFF",
  text: "#1a1a1a",
  textMuted: "#666666",
  border: "#e5e5e5",
};

export default function KioskLocationSelector({
  locations,
  userName,
}: {
  locations: Location[];
  userName: string;
}) {
  const router = useRouter();
  const t = useTranslations("kiosk");

  function handleSelectLocation(locationId: string) {
    router.push(`/kiosk?locationId=${locationId}`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.surface,
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 48px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src="/Oh_Logo_Large.png"
            alt="Oh! Logo"
            style={{ width: 48, height: 48 }}
          />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 600, color: COLORS.text }}>
              {t("setup.title")}
            </div>
            <div style={{ fontSize: "0.9rem", color: COLORS.textMuted }}>
              {t("setup.loggedInAs", { name: userName })}
            </div>
          </div>
        </div>
        <SignOutButton>
          <button
            style={{
              padding: "10px 20px",
              background: "transparent",
              border: `2px solid ${COLORS.border}`,
              borderRadius: 8,
              color: COLORS.textMuted,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {t("setup.signOut")}
          </button>
        </SignOutButton>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {t("setup.selectLocation")}
        </h1>
        <p
          style={{
            fontSize: "1.1rem",
            color: COLORS.textMuted,
            marginBottom: 48,
            textAlign: "center",
          }}
        >
          {t("setup.selectLocationDescription")}
        </p>

        {/* Location Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
            maxWidth: 900,
            width: "100%",
          }}
        >
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => handleSelectLocation(location.id)}
              style={{
                padding: 32,
                background: COLORS.primaryLight,
                border: `3px solid ${COLORS.primary}`,
                borderRadius: 16,
                cursor: "pointer",
                textAlign: "left",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: COLORS.text,
                  marginBottom: 8,
                }}
              >
                {location.name}
              </div>
              <div style={{ fontSize: "1rem", color: COLORS.textMuted }}>
                {location.city}
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: "0.85rem",
                  color: COLORS.primary,
                  fontWeight: 600,
                }}
              >
                {t("setup.launchKiosk")} →
              </div>
            </button>
          ))}
        </div>

        {/* Direct URL Info */}
        <div
          style={{
            marginTop: 48,
            padding: 24,
            background: "#f5f5f0",
            borderRadius: 12,
            maxWidth: 600,
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: COLORS.primary,
              marginBottom: 12,
            }}
          >
            {t("setup.directUrls")}
          </div>
          <div style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
            {locations.map((location) => (
              <div key={location.id} style={{ marginBottom: 8 }}>
                <strong>{location.name}:</strong>{" "}
                <code
                  style={{
                    background: "rgba(0,0,0,0.05)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                  }}
                >
                  /kiosk?locationId={location.id}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
