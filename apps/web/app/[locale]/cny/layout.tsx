import "./cny.css";
import { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "You're Invited! CNY 2026 Party",
  description: "Join us for a Chinese New Year celebration - Year of the Horse",
  openGraph: {
    title: "You're Invited! CNY 2026",
    description: "Join us for a Chinese New Year celebration - Year of the Horse 2026",
    type: "website",
    siteName: "Oh! CNY 2026",
    images: [
      {
        url: "/cny/og-image.png",
        width: 1200,
        height: 630,
        alt: "Chinese New Year 2026 - Year of the Horse Party Invitation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "You're Invited! CNY 2026",
    description: "Join us for a Chinese New Year celebration - Year of the Horse 2026",
    images: ["/cny/og-image.png"],
  },
};

export default function CNYLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "#910C1E",
      }}
    >
      {children}
    </div>
  );
}
