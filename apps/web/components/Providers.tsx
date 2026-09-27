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
        {chappy ? <ChappyChatWrapper /> : null}
      </ToastProvider>
    </CartProvider>
  );
}
