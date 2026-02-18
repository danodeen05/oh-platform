import { Metadata, Viewport } from "next";
import "../cny.css";
import "./slides.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "CNY 2026 Party Slideshow",
  description: "Year of the Horse - Zodiac Slideshow",
};

export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="slides-kiosk-container">
      <div className="slides-aspect-ratio-wrapper">{children}</div>
    </div>
  );
}
