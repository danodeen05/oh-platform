import "./cny.css";
import { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Task D11: the invitation's metadata in the reader's language (strings only; the layout is unchanged).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cny.meta");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
      siteName: t("siteName"),
      images: [{ url: "/cny/og-image.png", width: 1200, height: 630, alt: t("ogAlt") }],
    },
    twitter: { card: "summary_large_image", title: t("ogTitle"), description: t("ogDescription"), images: ["/cny/og-image.png"] },
  };
}

export default function CNYLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // legacy-ui: CNY keeps the retired global button/input/a/h1-h6/p rules (Task C1).
    <div
      className="legacy-ui"
      style={{
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
