import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Oh Beef Noodle Soup",
  description: "Order your favorite noodle soup",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&family=Noto+Serif+TC:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          style={{
            margin: 0,
            padding: 0,
            background: "#ffffff",
            color: "#2a2a2a",
            fontFamily: '"Raleway", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Header />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
