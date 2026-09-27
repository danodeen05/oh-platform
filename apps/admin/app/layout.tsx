import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ApiAuthInit from "../components/ApiAuthInit";
import { fontVariables } from "../lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Oh! Admin", template: "%s · Oh! Admin" },
  appleWebApp: { capable: true, title: "Oh! Admin", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1C1B19" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={fontVariables}>
        <body style={{ margin: 0 }}>
          <ApiAuthInit />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
