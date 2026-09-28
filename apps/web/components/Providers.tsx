"use client";

import dynamic from "next/dynamic";
import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/contexts/cart-context";

// Dynamically import ChappyChat with SSR disabled to avoid hydration issues
const ChappyChatWrapper = dynamic(
  () => import("@/components/ChappyChatWrapper"),
  { ssr: false }
);

export function Providers({ children, chappy = true }: { children: React.ReactNode; chappy?: boolean }) {
  return (
    <CartProvider>
      <ToastProvider>
        {children}
        {/* legacy-ui: the old Chappy widget stays mounted (R6) and still uses
            bare button/input/a/h1-h3 tags, so it needs the scoped rules too
            until Task E1 replaces it. */}
        {chappy ? (
          <div className="legacy-ui">
            <ChappyChatWrapper />
          </div>
        ) : null}
      </ToastProvider>
    </CartProvider>
  );
}
