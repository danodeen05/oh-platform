"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/contexts/cart-context";

// Chappy is not mounted here: the site shell opens it from the dock and the
// (legacy) chrome from a floating launcher, both through
// components/site/chappy/ChappyProvider.tsx (Task E1).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ToastProvider>{children}</ToastProvider>
    </CartProvider>
  );
}
