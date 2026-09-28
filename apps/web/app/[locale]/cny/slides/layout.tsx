import { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import "../cny.css";
import "./slides.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cny.slidesMeta");
  return { title: t("title"), description: t("description") };
}

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
